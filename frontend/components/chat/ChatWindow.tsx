'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { TypingIndicator } from './TypingIndicator'
import { OnlineStatus } from './OnlineStatus'
import { MessageSkeleton } from '@/components/ui/Skeleton'
import { useInfiniteMessages } from '@/hooks/useInfiniteMessages'
import { useGetConversationQuery } from '@/store/api/conversationApi'
import { useMarkAsReadMutation } from '@/store/api/messageApi'
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch'
import { setActiveConversation } from '@/store/slices/chatSlice'
import { getSocket } from '@/lib/socket'
import { getSenderId } from '@/lib/utils'

interface ChatWindowProps {
  conversationId: string
}

export const ChatWindow = ({ conversationId }: ChatWindowProps) => {
  const dispatch = useAppDispatch()
  const me = useAppSelector((s) => s.auth.user)
  const accessToken = useAppSelector((s) => s.auth.accessToken)
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
    <section className="flex h-full flex-1 flex-col bg-bg">
      <header className="flex items-center gap-3 border-b border-line bg-bg-panel px-4 py-3">
        <Avatar src={avatar} name={title} size="md" />
        <div className="flex min-w-0 flex-col">
          <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
          {other && <OnlineStatus userId={other._id} fallbackLastSeen={other.lastSeen} />}
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-2"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)',
          backgroundSize: '20px 20px',
        }}
      >
        <div ref={topSentinelRef} />
        {isFetching && messages.length === 0 ? (
          <MessageSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm text-ink-muted">No messages yet</p>
            <p className="mt-1 text-xs text-ink-dim">Say hi and start the conversation</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1]
            const sameSender =
              prev && getSenderId(prev.sender) === getSenderId(m.sender)
            const showAvatar = !sameSender
            return (
              <MessageBubble
                key={m._id}
                message={m}
                showAvatar={showAvatar}
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
