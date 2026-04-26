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
import { useGetConversationQuery } from '@/store/api/conversationApi'
import { useMarkAsReadMutation } from '@/store/api/messageApi'
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch'
import { setActiveConversation } from '@/store/slices/chatSlice'
import { getSocket } from '@/lib/socket'
import { cn, getSenderId } from '@/lib/utils'
import { useChatBg } from '@/hooks/useChatBg'
import { conversationApi } from '@/store/api/conversationApi'

interface ChatWindowProps {
  conversationId: string
}

export const ChatWindow = ({ conversationId }: ChatWindowProps) => {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const me = useAppSelector((s) => s.auth.user)
  const accessToken = useAppSelector((s) => s.auth.accessToken)
  const [showBgPicker, setShowBgPicker] = useState(false)
  const { bg, setPreset, setCustom, reset, bgStyle } = useChatBg(conversationId)
  const { data: conversation } = useGetConversationQuery(conversationId)
  const { messages, hasMore, loadMore, isFetching } = useInfiniteMessages(conversationId)
  const [markAsRead] = useMarkAsReadMutation()

  const scrollRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const lastAutoscrollCount = useRef(0)
  const initialScrollDone = useRef(false)

  const socket = useMemo(() => getSocket(accessToken), [accessToken])

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

  return (
    <section className="flex h-full flex-1 flex-col overflow-hidden bg-bg">
      {/* ── Header ── */}
      <header className="relative flex shrink-0 items-center gap-2 border-b border-line bg-bg-panel/95 backdrop-blur-sm px-2 py-2 sm:px-4 sm:py-3">
        {/* Back — mobile only */}
        <button
          onClick={() => router.push('/')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-bg-hover hover:text-ink active:scale-95 md:hidden"
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <Avatar src={avatar} name={title} size="md" />

        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate text-sm font-semibold text-ink leading-tight">{title}</h2>
          {other && <OnlineStatus userId={other._id} fallbackLastSeen={other.lastSeen} />}
        </div>

        {/* Wallpaper button */}
        <button
          onClick={() => setShowBgPicker((v) => !v)}
          title="Change wallpaper"
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition active:scale-95',
            showBgPicker ? 'bg-bg-hover text-brand' : 'text-ink-muted hover:bg-bg-hover hover:text-ink'
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
              />
            )
          })
        )}
      </div>

      <TypingIndicator conversationId={conversationId} />
      <MessageInput conversationId={conversationId} socket={socket} />
    </section>
  )
}
