'use client'

import dynamic from 'next/dynamic'
import { cn, formatTime, getSenderId } from '@/lib/utils'
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch'
import { openLightbox, pushToast, toast } from '@/store/slices/uiSlice'
import { Avatar } from '@/components/ui/Avatar'
import { ReadReceipt } from './ReadReceipt'
import { VideoPlayer } from './VideoPlayer'
import { FileAttachment } from './FileAttachment'
import { useDeleteMessageMutation } from '@/store/api/messageApi'
import type { IMessage, IConversationParticipant } from '@/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { EmojiClickData } from 'emoji-picker-react'
import { getSocket } from '@/lib/socket'

interface MessageBubbleProps {
  message: IMessage
  showAvatar: boolean
  participants: IConversationParticipant[]
  conversationId: string
  onReply: (message: IMessage) => void
}

// ── Emoji detection helpers ────────────────────────────────────────────────────
const EMOJI_RE = /\p{Extended_Pictographic}/gu

const isEmojiOnly = (text: string): boolean => {
  const trimmed = text.trim()
  if (!trimmed) return false
  // Remove all emoji + skin-tone modifiers + ZWJ + variation selectors + whitespace
  const stripped = trimmed.replace(
    /[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D\s]/gu,
    ''
  )
  return stripped.length === 0
}

const countEmoji = (text: string): number => {
  const matches = text.match(EMOJI_RE)
  return matches ? matches.length : 0
}

const emojiSizeClass = (count: number): string => {
  if (count === 1) return 'text-5xl'
  if (count === 2) return 'text-5xl'
  if (count <= 4) return 'text-4xl'
  return 'text-3xl'
}

// ── Component ─────────────────────────────────────────────────────────────────
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false })

export const MessageBubble = ({
  message,
  showAvatar,
  participants,
  conversationId,
  onReply,
}: MessageBubbleProps) => {
  const dispatch = useAppDispatch()
  const currentUserId = useAppSelector((s) => s.auth.user?.id)
  const accessToken = useAppSelector((s) => s.auth.accessToken)
  const socket = useMemo(() => getSocket(accessToken), [accessToken])
  const [showReactions, setShowReactions] = useState(false)
  const [showMoreReactions, setShowMoreReactions] = useState(false)
  const [showDeleteMenu, setShowDeleteMenu] = useState(false)
  const quickReactionRef = useRef<HTMLDivElement>(null)
  const moreReactionRef = useRef<HTMLDivElement>(null)
  const deleteMenuRef = useRef<HTMLDivElement>(null)
  const [deleteMessage] = useDeleteMessageMutation()
  const senderId = getSenderId(message.sender)
  const isOwn = senderId === currentUserId
  const sender =
    typeof message.sender === 'object'
      ? message.sender
      : participants.find((p) => p._id === senderId)

  const otherParticipants = participants.filter((p) => p._id !== currentUserId)
  const allRead =
    isOwn &&
    otherParticipants.length > 0 &&
    otherParticipants.every((p) => message.readBy.some((r) => r.user === p._id))

  const status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' =
    message.status === 'failed'
      ? 'failed'
      : message.status === 'sending'
        ? 'sending'
        : allRead
          ? 'read'
          : 'sent'

  const isTextMsg = message.type === 'text'
  const emojiOnly = isTextMsg && isEmojiOnly(message.content ?? '')
  const emojiCount = emojiOnly ? countEmoji(message.content ?? '') : 0

  const reactionGroups = useMemo(() => {
    const map = new Map<string, { emoji: string; users: string[] }>()
    ;(message.reactions ?? []).forEach((r) => {
      const prev = map.get(r.emoji)
      if (prev) prev.users.push(r.user)
      else map.set(r.emoji, { emoji: r.emoji, users: [r.user] })
    })
    return Array.from(map.values())
  }, [message.reactions])
  const myReactionEmoji = useMemo(
    () => message.reactions?.find((r) => r.user === currentUserId)?.emoji,
    [message.reactions, currentUserId]
  )

  const onToggleReaction = async (emoji: string) => {
    if (!socket) return
    try {
      const res = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        socket.emit('react_message', { messageId: message._id, emoji }, (ack: { ok: boolean; error?: string }) => {
          resolve(ack)
        })
      })
      if (!res.ok) throw new Error(res.error || 'Reaction failed')
      setShowReactions(false)
      setShowMoreReactions(false)
    } catch (err) {
      dispatch(pushToast(toast.error((err as { message?: string })?.message ?? 'Reaction failed')))
    }
  }

  const onMoreReactionClick = (data: EmojiClickData) => {
    void onToggleReaction(data.emoji)
  }

  useEffect(() => {
    if (!showMoreReactions) return
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node
      const insideQuick = quickReactionRef.current?.contains(target)
      const insideMore = moreReactionRef.current?.contains(target)
      if (!insideQuick && !insideMore) {
        setShowMoreReactions(false)
        setShowReactions(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [showMoreReactions])

  useEffect(() => {
    if (!showDeleteMenu) return
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (!deleteMenuRef.current?.contains(target)) {
        setShowDeleteMenu(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [showDeleteMenu])

  const onDelete = () => {
    setShowDeleteMenu((v) => !v)
  }

  const onConfirmDelete = async (scope: 'me' | 'everyone') => {
    try {
      await deleteMessage({ messageId: message._id, conversationId, scope }).unwrap()
      setShowDeleteMenu(false)
    } catch (err) {
      dispatch(pushToast(toast.error((err as { message?: string })?.message ?? 'Delete failed')))
    }
  }

  // ── Deleted ──
  if (message.isDeleted) {
    return (
      <div className={cn('flex w-full px-4 py-1', isOwn ? 'justify-end' : 'justify-start')}>
        <div className="rounded-2xl bg-bg-hover px-3.5 py-2 text-sm italic text-ink-muted">
          This message was deleted
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex w-full gap-2 px-4 py-0.5',
        isOwn ? 'justify-end' : 'justify-start'
      )}
    >
      {!isOwn && (
        <div className="w-8 shrink-0">
          {showAvatar && sender && (
            <Avatar src={sender.avatar} name={sender.name} size="xs" />
          )}
        </div>
      )}

      <div className={cn('flex max-w-[75%] flex-col', isOwn ? 'items-end' : 'items-start')}>
        {!isOwn && showAvatar && sender && (
          <span className="mb-0.5 pl-1 text-xs font-medium text-ink-muted">{sender.name}</span>
        )}

        {/* ── Emoji-only message — no bubble bg ── */}
        {emojiOnly ? (
          <div className="flex flex-col items-end gap-0.5">
            <span
              className={cn(
                'leading-none select-none',
                emojiSizeClass(emojiCount)
              )}
              style={{ filter: message.status === 'sending' ? 'opacity(0.6)' : undefined }}
            >
              {message.content}
            </span>
            <div
              className={cn(
                'flex items-center gap-1 text-[10px]',
                isOwn ? 'text-ink-dim' : 'text-ink-dim'
              )}
            >
              <span>{formatTime(message.createdAt)}</span>
              {isOwn && <ReadReceipt status={status} />}
            </div>
          </div>
        ) : (
          /* ── Normal message bubble ── */
          <div className="group relative">
            <div className="absolute -top-3 right-1 z-10 hidden items-center gap-1 rounded-full border border-white/10 bg-bg-panel/95 px-1.5 py-1 shadow-lg backdrop-blur group-hover:flex">
              <button
                onClick={() => onReply(message)}
                className="rounded-full p-1 text-ink-dim transition hover:bg-white/10 hover:text-ink"
                title="Reply"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M10 9L5 12l5 3V9zM5 12h9a5 5 0 015 5v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={() => setShowReactions((v) => !v)}
                className="rounded-full p-1 text-ink-dim transition hover:bg-white/10 hover:text-ink"
                title="React"
              >
                🙂
              </button>
              <button
                onClick={onDelete}
                className="rounded-full p-1 text-ink-dim transition hover:bg-white/10 hover:text-rose-300"
                title="Delete"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M8 6V4h8v2m-9 0l1 14h6l1-14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {showDeleteMenu && (
              <div
                ref={deleteMenuRef}
                className={cn(
                  'absolute top-7 z-30 min-w-[170px] overflow-hidden rounded-xl border border-white/10 bg-bg-panel/95 p-1 shadow-xl backdrop-blur',
                  isOwn ? 'right-0' : 'left-0'
                )}
              >
                <button
                  onClick={() => onConfirmDelete('me')}
                  className="w-full rounded-lg px-3 py-2 text-left text-xs text-ink transition hover:bg-white/10"
                >
                  Delete for me
                </button>
                {isOwn && (
                  <button
                    onClick={() => onConfirmDelete('everyone')}
                    className="w-full rounded-lg px-3 py-2 text-left text-xs text-rose-300 transition hover:bg-white/10"
                  >
                    Delete for everyone
                  </button>
                )}
              </div>
            )}

            {showReactions && (
              <div
                ref={quickReactionRef}
                className={cn(
                  'absolute -top-11 z-20 flex items-center gap-1 rounded-full border border-white/10 bg-bg-panel/95 p-1 shadow-lg backdrop-blur',
                  isOwn ? 'right-0' : 'left-0'
                )}
              >
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => onToggleReaction(emoji)}
                    className="rounded-full px-2 py-1 text-xl leading-none transition hover:bg-white/10"
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={() => setShowMoreReactions((v) => !v)}
                  className="rounded-full px-2 py-0.5 text-sm font-semibold text-ink-dim transition hover:bg-white/10 hover:text-ink"
                  title="More reactions"
                >
                  +
                </button>
                {myReactionEmoji && (
                  <button
                    onClick={() => onToggleReaction(myReactionEmoji)}
                    className="rounded-full px-2 py-0.5 text-xs font-medium text-rose-300 transition hover:bg-white/10"
                    title="Remove my reaction"
                  >
                    Remove
                  </button>
                )}
              </div>
            )}

            {showReactions && showMoreReactions && (
              <div
                ref={moreReactionRef}
                className={cn(
                  'absolute -top-[460px] z-30 overflow-hidden rounded-2xl border border-white/10 shadow-2xl',
                  isOwn ? 'right-0' : 'left-0'
                )}
              >
                <EmojiPicker
                  onEmojiClick={onMoreReactionClick}
                  theme={'dark' as never}
                  skinTonesDisabled
                  searchPlaceholder="Search emoji…"
                  height={430}
                  width={360}
                />
              </div>
            )}

            <div
              className={cn(
                'relative rounded-2xl px-3.5 py-2 text-sm shadow-sm',
                isOwn
                  ? 'rounded-br-md bg-brand text-white'
                  : 'rounded-bl-md bg-bg-hover text-ink',
                message.type !== 'text' && 'p-1.5'
              )}
            >
              {message.replyTo && (
                <div
                  className={cn(
                    'mb-1.5 rounded-lg border-l-2 px-2 py-1 text-[11px]',
                    isOwn
                      ? 'border-white/70 bg-white/15 text-white/85'
                      : 'border-brand/80 bg-bg-panel/70 text-ink-muted'
                  )}
                >
                  {message.replyTo.isDeleted
                    ? 'Deleted message'
                    : message.replyTo.type === 'text'
                      ? message.replyTo.content || 'Message'
                      : message.replyTo.fileName || `${message.replyTo.type} attachment`}
                </div>
              )}

              {message.type === 'image' && message.fileUrl && (
                <img
                  src={message.fileUrl}
                  alt={message.fileName ?? 'image'}
                  className="max-h-80 max-w-xs cursor-zoom-in rounded-lg object-cover"
                  onClick={() => dispatch(openLightbox(message.fileUrl!))}
                />
              )}

              {message.type === 'video' && message.fileUrl && (
                <VideoPlayer src={message.fileUrl} poster={message.thumbnailUrl} />
              )}

              {message.type === 'file' && message.fileUrl && (
                <FileAttachment
                  url={message.fileUrl}
                  name={message.fileName}
                  size={message.fileSize}
                  mimeType={message.mimeType}
                  isOwn={isOwn}
                />
              )}

              {message.type === 'text' && (
                <p className="whitespace-pre-wrap break-words text-[15px] leading-6">{message.content}</p>
              )}

              {message.type !== 'text' && message.content && (
                <p className="mt-1 whitespace-pre-wrap break-words px-1.5 pb-1 text-xs">
                  {message.content}
                </p>
              )}

              <div
                className={cn(
                  'mt-1 flex items-center gap-1 px-1 text-[10px]',
                  isOwn ? 'justify-end text-white/75' : 'justify-start text-ink-dim'
                )}
              >
                <span>{formatTime(message.createdAt)}</span>
                {isOwn && <ReadReceipt status={status} />}
              </div>
            </div>
          </div>
        )}

        {reactionGroups.length > 0 && (
          <div className={cn('mt-1 flex flex-wrap gap-1 px-1', isOwn ? 'justify-end' : 'justify-start')}>
            {reactionGroups.map((r) => {
              const reacted = Boolean(currentUserId && r.users.includes(currentUserId))
              return (
                <button
                  key={r.emoji}
                  onClick={() => onToggleReaction(r.emoji)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition',
                    reacted
                      ? 'border-brand/40 bg-brand/20 text-white'
                      : 'border-white/10 bg-bg-panel/70 text-ink-muted hover:bg-bg-hover'
                  )}
                >
                  <span className="text-base leading-none">{r.emoji}</span>
                  <span>{r.users.length}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
