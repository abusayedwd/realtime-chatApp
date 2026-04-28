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
import { pushToast, toast } from '@/store/slices/uiSlice'
import { useWebRTCCall } from '@/hooks/useWebRTCCall'
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
  const [replyingTo, setReplyingTo] = useState<IMessage | null>(null)
  const { bg, setPreset, setCustom, reset, bgStyle } = useChatBg(conversationId)
  const { data: conversation } = useGetConversationQuery(conversationId)
  const { messages, hasMore, loadMore, isFetching } = useInfiniteMessages(conversationId)
  const [markAsRead] = useMarkAsReadMutation()

  const scrollRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const lastAutoscrollCount = useRef(0)
  const initialScrollDone = useRef(false)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)

  const socket = useMemo(() => getSocket(accessToken), [accessToken])
  const {
    callState,
    callType,
    incomingCall,
    error: callError,
    localStream,
    remoteStream,
    connectedAt,
    isMuted,
    isCameraOff,
    startCall,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = useWebRTCCall({ socket })

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

  useEffect(() => {
    if (!callError) return
    dispatch(pushToast(toast.error(callError)))
  }, [callError, dispatch])

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream ?? null
    }
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream ?? null
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = callType === 'audio' ? (remoteStream ?? null) : null
    }
  }, [callType, remoteStream])

  const isOneToOne = Boolean(!conversation?.isGroup && other?._id)
  const isCallLive = callState === 'connected' || callState === 'connecting' || callState === 'calling'
  const isIncomingForThisConversation =
    incomingCall?.conversationId === conversationId && incomingCall.fromUserId === other?._id

  const handleStartCall = async (kind: 'audio' | 'video') => {
    if (!other?._id) return
    try {
      await startCall({ toUserId: other._id, conversationId, callType: kind })
    } catch (err) {
      dispatch(pushToast(toast.error((err as Error).message)))
    }
  }

  const handleAcceptCall = async () => {
    try {
      await acceptIncomingCall()
    } catch (err) {
      dispatch(pushToast(toast.error((err as Error).message)))
    }
  }

  const handleRejectCall = async () => {
    try {
      await rejectIncomingCall()
    } catch (err) {
      dispatch(pushToast(toast.error((err as Error).message)))
    }
  }

  const handleEndCall = async () => {
    await endCall()
  }

  const [callElapsedSec, setCallElapsedSec] = useState(0)
  useEffect(() => {
    if (!connectedAt || callState !== 'connected') {
      setCallElapsedSec(0)
      return
    }
    const tick = () => setCallElapsedSec(Math.floor((Date.now() - connectedAt) / 1000))
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [callState, connectedAt])

  const callDurationLabel = `${String(Math.floor(callElapsedSec / 60)).padStart(2, '0')}:${String(
    callElapsedSec % 60
  ).padStart(2, '0')}`

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
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="6.5" width="13" height="11" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
                <path d="M16 10l4-2v8l-4-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
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
      </header>

      {isIncomingForThisConversation && (
        <div className="absolute inset-x-3 top-16 z-20 rounded-2xl border border-white/15 bg-bg-panel/95 p-4 shadow-2xl backdrop-blur">
          <p className="text-sm font-semibold text-ink">{other?.name ?? 'Someone'} is calling...</p>
          <p className="mt-1 text-xs text-ink-dim">
            {incomingCall?.callType === 'video' ? 'Incoming video call' : 'Incoming audio call'}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => void handleAcceptCall()}
              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
            >
              Accept
            </button>
            <button
              onClick={() => void handleRejectCall()}
              className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {isCallLive && (
        <div className="absolute inset-x-3 top-16 z-20 rounded-2xl border border-white/15 bg-black/80 p-3 shadow-2xl backdrop-blur">
          <audio ref={remoteAudioRef} autoPlay playsInline />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-white/90">
              {callState === 'calling' && `Calling ${other?.name ?? 'user'}...`}
              {callState === 'connecting' && 'Connecting call...'}
              {callState === 'connected' &&
                `${callType === 'video' ? 'Video' : 'Audio'} call with ${other?.name ?? 'user'}`}
            </p>
            {callState === 'connected' && (
              <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/85">
                {callDurationLabel}
              </span>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition',
                  isMuted ? 'bg-amber-600 text-white' : 'bg-white/15 text-white hover:bg-white/20'
                )}
              >
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              {callType === 'video' && (
                <button
                  onClick={toggleCamera}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition',
                    isCameraOff ? 'bg-amber-600 text-white' : 'bg-white/15 text-white hover:bg-white/20'
                  )}
                >
                  {isCameraOff ? 'Camera on' : 'Camera off'}
                </button>
              )}
              <button
                onClick={() => void handleEndCall()}
                className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-rose-500"
              >
                End
              </button>
            </div>
          </div>

          {callType === 'video' && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="overflow-hidden rounded-xl border border-white/15 bg-black/60">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="h-32 w-full object-cover"
                />
                <p className="border-t border-white/10 px-2 py-1 text-[10px] text-white/80">Remote</p>
              </div>
              <div className="overflow-hidden rounded-xl border border-white/15 bg-black/60">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-32 w-full object-cover"
                />
                <p className="border-t border-white/10 px-2 py-1 text-[10px] text-white/80">You</p>
              </div>
            </div>
          )}
        </div>
      )}

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
      <MessageInput
        conversationId={conversationId}
        socket={socket}
        replyTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />
    </section>
  )
}
