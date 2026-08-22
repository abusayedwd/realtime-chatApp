'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { TypingIndicator } from './TypingIndicator'
import { OnlineStatus } from './OnlineStatus'
import { ConversationBgPicker } from './ConversationBgPicker'
import { MessageSkeleton } from '@/components/ui/Skeleton'
import { useInfiniteMessages } from '@/hooks/useInfiniteMessages'
import { useGetConversationQuery, useDeleteConversationMutation } from '@/store/api/conversationApi'
import { useMarkAsReadMutation } from '@/store/api/messageApi'
import { useBlockUserMutation, useUnblockUserMutation } from '@/store/api/userApi'
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch'
import { setActiveConversation } from '@/store/slices/chatSlice'
import { updateUser } from '@/store/slices/authSlice'
import { getSocket } from '@/lib/socket'
import { cn, getSenderId } from '@/lib/utils'
import { useChatBg } from '@/hooks/useChatBg'
import { conversationApi } from '@/store/api/conversationApi'
import { pushToast, toast } from '@/store/slices/uiSlice'
import { useCall } from './CallProvider'
import type { IMessage } from '@/types'

interface ChatWindowProps {
  conversationId: string
}

export const ChatWindow = ({ conversationId }: ChatWindowProps) => {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const me = useAppSelector((s) => s.auth.user)
  const accessToken = useAppSelector((s) => s.auth.accessToken)
  const [showBgPicker, setShowBgPicker] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [replyingTo, setReplyingTo] = useState<IMessage | null>(null)
  const { bg, setPreset, setCustom, reset, bgStyle } = useChatBg(conversationId)
  const { data: conversation } = useGetConversationQuery(conversationId)
  const { messages, hasMore, loadMore, isFetching } = useInfiniteMessages(conversationId)
  const [markAsRead] = useMarkAsReadMutation()
  const [blockUser] = useBlockUserMutation()
  const [unblockUser] = useUnblockUserMutation()
  const [deleteConversation] = useDeleteConversationMutation()

  const scrollRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const lastAutoscrollCount = useRef(0)
  const initialScrollDone = useRef(false)

  const socket = useMemo(() => getSocket(accessToken), [accessToken])
  const { callState, startCall } = useCall()

  // Track active conversation in chat slice → resets unread, drives useSocket
  useEffect(() => {
    dispatch(setActiveConversation(conversationId))
    return () => {
      dispatch(setActiveConversation(null))
    }
  }, [conversationId, dispatch])

  // Auto-scroll to bottom when new messages arrive (from self or others),
  // but NOT when paginating backwards (page 2+).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    if (!initialScrollDone.current && messages.length > 0) {
      el.scrollTop = el.scrollHeight
      initialScrollDone.current = true
      lastAutoscrollCount.current = messages.length
      return
    }

    if (messages.length > lastAutoscrollCount.current) {
      const newCount = messages.length - lastAutoscrollCount.current
      const added = messages.slice(-newCount)
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160
      const ownMessageArrived = added.some((m) => getSenderId(m.sender) === me?.id)
      if (nearBottom || ownMessageArrived) {
        el.scrollTop = el.scrollHeight
      }
      lastAutoscrollCount.current = messages.length
    } else {
      lastAutoscrollCount.current = messages.length
    }
  }, [messages, me?.id])

  // Infinite scroll via IntersectionObserver on the top sentinel
  useEffect(() => {
    const sentinel = topSentinelRef.current
    const scroller = scrollRef.current
    if (!sentinel || !scroller || !hasMore) return

    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && !isFetching) {
          const prevScrollHeight = scroller.scrollHeight
          const prevScrollTop = scroller.scrollTop
          await loadMore()
          requestAnimationFrame(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop =
                scrollRef.current.scrollHeight - prevScrollHeight + prevScrollTop
            }
          })
        }
      },
      { root: scroller, rootMargin: '200px 0px 0px 0px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isFetching, loadMore])

  // Join room + mark as read on open
  useEffect(() => {
    if (!socket || !me) return
    socket.emit('join_conversation', { conversationId })
    return () => {
      socket.emit('leave_conversation', { conversationId })
    }
  }, [conversationId, socket, me])

  // Listen for real-time background changes — only update cache, never call API (prevents loop)
  useEffect(() => {
    if (!socket) return
    const handler = ({ conversationId: cid, background }: { conversationId: string; background: string }) => {
      if (cid !== conversationId) return
      dispatch(conversationApi.util.updateQueryData('getConversation', cid, (draft) => {
        draft.background = background
      }))
    }
    socket.on('conversation_bg_changed', handler)
    return () => { socket.off('conversation_bg_changed', handler) }
  }, [socket, conversationId, dispatch])

  // Compute unread-by-me message IDs → mark read (debounced)
  useEffect(() => {
    if (!me || messages.length === 0) return
    const unreadIds = messages
      .filter(
        (m) =>
          !m.clientTempId &&
          getSenderId(m.sender) !== me.id &&
          !m.readBy.some((r) => r.user === me.id)
      )
      .map((m) => m._id)
    if (unreadIds.length === 0) return
    const t = setTimeout(() => {
      markAsRead({ conversationId, messageIds: unreadIds })
    }, 500)
    return () => clearTimeout(t)
  }, [messages, me, conversationId, markAsRead])

  const other = conversation?.participants.find((p) => p._id !== me?.id)
  const title = conversation?.isGroup
    ? conversation?.groupName ?? 'Group'
    : other?.name ?? 'Conversation'
  const avatar = conversation?.isGroup ? conversation?.groupAvatar : other?.avatar

  useEffect(() => {
    setReplyingTo(null)
  }, [conversationId])

  // Close the header options menu on outside click
  useEffect(() => {
    if (!showMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
        setConfirmDelete(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  const isOneToOne = Boolean(!conversation?.isGroup && other?._id)
  const isCallLive = callState === 'connected' || callState === 'connecting' || callState === 'calling'
  const isBlockedByMe = Boolean(other?._id && me?.blockedUsers?.includes(other._id))

  const handleStartCall = async (kind: 'audio' | 'video') => {
    if (!other?._id) return
    try {
      await startCall({ toUserId: other._id, conversationId, callType: kind })
    } catch (err) {
      dispatch(pushToast(toast.error((err as Error).message)))
    }
  }

  const handleToggleBlock = async () => {
    if (!other?._id) return
    try {
      const updated = isBlockedByMe
        ? await unblockUser(other._id).unwrap()
        : await blockUser(other._id).unwrap()
      dispatch(updateUser({ blockedUsers: updated.blockedUsers }))
      dispatch(pushToast(toast.success(isBlockedByMe ? 'User unblocked' : 'User blocked')))
      setShowMenu(false)
    } catch (err) {
      dispatch(pushToast(toast.error((err as { message?: string }).message ?? 'Action failed')))
    }
  }

  const handleDeleteChat = async () => {
    try {
      await deleteConversation(conversationId).unwrap()
      setShowMenu(false)
      setConfirmDelete(false)
      router.push('/')
    } catch (err) {
      dispatch(pushToast(toast.error((err as { message?: string }).message ?? 'Delete failed')))
    }
  }

  return (
    <section className="relative flex h-full flex-1 flex-col overflow-hidden bg-bg/70">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/[0.04] to-transparent" />
      {/* ── Header ── */}
      <header className="relative z-10 flex shrink-0 items-center gap-2 border-b border-white/10 bg-bg-panel/75 backdrop-blur-xl px-2 py-2 sm:px-4 sm:py-3">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        {/* Back — mobile only */}
        <button
          onClick={() => router.push('/')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-white/10 hover:text-ink active:scale-95 md:hidden"
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <Avatar src={avatar} name={title} size="md" />

        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate text-sm font-semibold text-ink leading-tight">{title}</h2>
          {other && (
            <OnlineStatus
              userId={other._id}
              fallbackLastSeen={other.lastSeen}
              fallbackIsOnline={other.isOnline}
            />
          )}
        </div>

        {isOneToOne && (
          <>
            <button
              onClick={() => void handleStartCall('audio')}
              disabled={isCallLive}
              title="Start audio call"
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] transition active:scale-95',
                isCallLive
                  ? 'cursor-not-allowed text-ink-dim opacity-60'
                  : 'text-ink-muted hover:bg-white/10 hover:text-ink'
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6.6 10.8a15.5 15.5 0 006.6 6.6l2.2-2.2a1 1 0 011-.24 11.4 11.4 0 003.6.58 1 1 0 011 1V20a1 1 0 01-1 1C11.8 21 3 12.2 3 2.99a1 1 0 011-1H7.4a1 1 0 011 1c0 1.25.2 2.46.58 3.6a1 1 0 01-.24 1L6.6 10.8z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              onClick={() => void handleStartCall('video')}
              disabled={isCallLive}
              title="Start video call"
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] transition active:scale-95',
                isCallLive
                  ? 'cursor-not-allowed text-ink-dim opacity-60'
                  : 'text-ink-muted hover:bg-white/10 hover:text-ink'
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </>
        )}

        {/* Wallpaper button */}
        <button
          onClick={() => setShowBgPicker((v) => !v)}
          title="Change wallpaper"
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] transition active:scale-95',
            showBgPicker ? 'bg-white/10 text-brand-light' : 'text-ink-muted hover:bg-white/10 hover:text-ink'
          )}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" />
            <path d="M3 15l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
          </svg>
        </button>

        <ConversationBgPicker
          open={showBgPicker}
          onClose={() => setShowBgPicker(false)}
          current={bg}
          onSelectPreset={setPreset}
          onSelectCustom={setCustom}
          onReset={reset}
        />

        {/* More options — block/unblock, delete chat */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setShowMenu((v) => !v)}
            title="More options"
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] transition active:scale-95',
              showMenu ? 'bg-white/10 text-brand-light' : 'text-ink-muted hover:bg-white/10 hover:text-ink'
            )}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="5" r="1.6" fill="currentColor" />
              <circle cx="12" cy="12" r="1.6" fill="currentColor" />
              <circle cx="12" cy="19" r="1.6" fill="currentColor" />
            </svg>
          </button>

          {showMenu && (
            <div className="absolute right-0 top-10 z-30 min-w-[190px] overflow-hidden rounded-xl border border-white/10 bg-bg-panel/95 p-1 shadow-xl backdrop-blur">
              {isOneToOne && (
                <button
                  onClick={() => void handleToggleBlock()}
                  className="w-full rounded-lg px-3 py-2 text-left text-xs text-ink transition hover:bg-white/10"
                >
                  {isBlockedByMe ? 'Unblock user' : 'Block user'}
                </button>
              )}
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full rounded-lg px-3 py-2 text-left text-xs text-rose-300 transition hover:bg-white/10"
                >
                  Delete chat
                </button>
              ) : (
                <div className="px-3 py-2">
                  <p className="mb-2 text-[11px] text-ink-dim">Delete this chat for you?</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleDeleteChat()}
                      className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-rose-500"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:bg-white/20"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── Messages ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ ...bgStyle, paddingBottom: '8px', paddingTop: '8px' }}
      >
        <div ref={topSentinelRef} />
        {isFetching && messages.length === 0 ? (
          <MessageSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-hover">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ink-dim">
                <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm font-medium text-ink">No messages yet</p>
            <p className="text-xs text-ink-dim">Say hi and start the conversation 👋</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1]
            const sameSender = prev && getSenderId(prev.sender) === getSenderId(m.sender)
            return (
              <MessageBubble
                key={m._id}
                message={m}
                showAvatar={!sameSender}
                participants={conversation?.participants ?? []}
                conversationId={conversationId}
                onReply={setReplyingTo}
              />
            )
          })
        )}
      </div>

      <TypingIndicator conversationId={conversationId} />
      {isBlockedByMe ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-bg-panel px-4 py-3">
          <p className="text-xs text-ink-dim">You've blocked {other?.name ?? 'this user'} — unblock to send messages.</p>
          <button
            onClick={() => void handleToggleBlock()}
            className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-white/20"
          >
            Unblock
          </button>
        </div>
      ) : (
        <MessageInput
          conversationId={conversationId}
          socket={socket}
          replyTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      )}
    </section>
  )
}
