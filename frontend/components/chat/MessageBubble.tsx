'use client'

import { cn, formatTime, getSenderId } from '@/lib/utils'
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch'
import { openLightbox } from '@/store/slices/uiSlice'
import { Avatar } from '@/components/ui/Avatar'
import { ReadReceipt } from './ReadReceipt'
import { VideoPlayer } from './VideoPlayer'
import { FileAttachment } from './FileAttachment'
import type { IMessage, IConversationParticipant } from '@/types'

interface MessageBubbleProps {
  message: IMessage
  showAvatar: boolean
  participants: IConversationParticipant[]
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
export const MessageBubble = ({ message, showAvatar, participants }: MessageBubbleProps) => {
  const dispatch = useAppDispatch()
  const currentUserId = useAppSelector((s) => s.auth.user?.id)
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
        'group flex w-full gap-2 px-4 py-0.5',
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
          <div
            className={cn(
              'relative rounded-2xl px-3.5 py-2 text-sm shadow-sm',
              isOwn
                ? 'rounded-br-md bg-brand text-white'
                : 'rounded-bl-md bg-bg-hover text-ink',
              message.type !== 'text' && 'p-1.5'
            )}
          >
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
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
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
        )}
      </div>
    </div>
  )
}
