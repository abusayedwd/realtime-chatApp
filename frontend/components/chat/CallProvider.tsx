'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch'
import { getSocket, setCallActive } from '@/lib/socket'
import { useWebRTCCall } from '@/hooks/useWebRTCCall'
import { useGetConversationQuery } from '@/store/api/conversationApi'
import { pushToast, toast } from '@/store/slices/uiSlice'
import { cn } from '@/lib/utils'

type CallContextValue = ReturnType<typeof useWebRTCCall>

const CallContext = createContext<CallContextValue | null>(null)

export const useCall = () => {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error('useCall must be used within CallProvider')
  return ctx
}

/** Repeating beep while a call is ringing — no audio asset needed. */
const useRingtone = (active: boolean) => {
  useEffect(() => {
    if (!active) return
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    let stopped = false

    const beep = () => {
      if (stopped) return
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.4)
    }

    void ctx.resume().catch(() => {})
    beep()
    const interval = window.setInterval(beep, 1000)
    return () => {
      stopped = true
      window.clearInterval(interval)
      void ctx.close().catch(() => {})
    }
  }, [active])
}

export const CallProvider = ({ children }: { children: React.ReactNode }) => {
  const dispatch = useAppDispatch()
  const accessToken = useAppSelector((s) => s.auth.accessToken)
  const socket = useMemo(() => getSocket(accessToken), [accessToken])
  const call = useWebRTCCall({ socket, accessToken })
  const {
    callState,
    callType,
    incomingCall,
    error: callError,
    localStream,
    remoteStream,
    activeConversationId,
    peerUserId,
    connectedAt,
    isMuted,
    isCameraOff,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = call

  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  const conversationId = incomingCall?.conversationId ?? activeConversationId
  const otherUserId = incomingCall?.fromUserId ?? peerUserId

  const { data: callConversation } = useGetConversationQuery(conversationId ?? '', {
    skip: !conversationId,
  })
  const peer = callConversation?.participants.find((p) => p._id === otherUserId)
  const peerName = peer?.name ?? 'User'

  useRingtone(callState === 'ringing' && Boolean(incomingCall))

  useEffect(() => {
    setCallActive(callState !== 'idle')
    return () => setCallActive(false)
  }, [callState])

  useEffect(() => {
    if (!callError) return
    dispatch(pushToast(toast.error(callError)))
  }, [callError, dispatch])

  useEffect(() => {
    if (!remoteAudioRef.current) return
    remoteAudioRef.current.srcObject = remoteStream ?? null
    if (remoteStream) {
      remoteAudioRef.current.play().catch(() => {})
    }
  }, [remoteStream])

  useEffect(() => {
    if (!localVideoRef.current) return
    localVideoRef.current.srcObject = localStream ?? null
    if (localStream) {
      localVideoRef.current.play().catch(() => {})
    }
  }, [localStream])

  useEffect(() => {
    if (!remoteVideoRef.current) return
    remoteVideoRef.current.srcObject = remoteStream ?? null
    if (remoteStream) {
      remoteVideoRef.current.play().catch(() => {})
    }
  }, [remoteStream])

  const isCallLive = callState === 'connected' || callState === 'connecting' || callState === 'calling'
  const isVideoCall = callType === 'video'
  const showVideoUi = isVideoCall && isCallLive

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

  const statusLabel =
    callState === 'calling'
      ? `Calling ${peerName}...`
      : callState === 'connecting'
        ? 'Connecting...'
        : callState === 'connected'
          ? `${isVideoCall ? 'Video' : 'Audio'} call with ${peerName}`
          : ''

  const handleAccept = async () => {
    try {
      await acceptIncomingCall()
    } catch (err) {
      dispatch(pushToast(toast.error((err as Error).message)))
    }
  }

  const handleReject = async () => {
    try {
      await rejectIncomingCall()
    } catch (err) {
      dispatch(pushToast(toast.error((err as Error).message)))
    }
  }

  const callControls = (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full transition',
          isMuted ? 'bg-amber-600 text-white' : 'bg-white/15 text-white hover:bg-white/25'
        )}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          {isMuted ? (
            <>
              <path d="M1 1l22 22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V5a3 3 0 00-5.94-.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M12 19v3M8 22h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </>
          ) : (
            <>
              <path d="M12 1a3 3 0 013 3v8a3 3 0 01-6 0V4a3 3 0 013-3z" stroke="currentColor" strokeWidth="1.8" />
              <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v3M8 22h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </>
          )}
        </svg>
      </button>
      {isVideoCall && (
        <button
          onClick={toggleCamera}
          title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full transition',
            isCameraOff ? 'bg-amber-600 text-white' : 'bg-white/15 text-white hover:bg-white/25'
          )}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      <button
        onClick={() => void endCall()}
        title="End call"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-600 text-white transition hover:bg-rose-500"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M6.6 10.8a15.5 15.5 0 006.6 6.6l2.2-2.2a1 1 0 011-.24 11.4 11.4 0 003.6.58 1 1 0 011 1V20a1 1 0 01-1 1C11.8 21 3 12.2 3 2.99a1 1 0 011-1H7.4a1 1 0 011 1c0 1.25.2 2.46.58 3.6a1 1 0 01-.24 1L6.6 10.8z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            transform="rotate(135 12 12)"
          />
        </svg>
      </button>
    </div>
  )

  return (
    <CallContext.Provider value={call}>
      {children}

      {/* Hidden audio for remote stream (audio + video calls) */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {incomingCall && callState === 'ringing' && (
        <div className="fixed inset-x-3 top-4 z-[70] mx-auto max-w-sm rounded-2xl border border-white/15 bg-bg-panel/95 p-4 shadow-2xl backdrop-blur">
          <p className="text-sm font-semibold text-ink">{peerName} is calling...</p>
          <p className="mt-1 text-xs text-ink-dim">
            {incomingCall.callType === 'video' ? 'Incoming video call' : 'Incoming audio call'}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => void handleAccept()}
              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
            >
              Accept
            </button>
            <button
              onClick={() => void handleReject()}
              className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Video call full-screen overlay */}
      {showVideoUi && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
          {!remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <p className="text-sm text-white/70">{statusLabel}</p>
            </div>
          )}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              'absolute bottom-24 right-4 z-10 h-28 w-20 rounded-xl border-2 border-white/20 object-cover shadow-lg sm:h-36 sm:w-28',
              isCameraOff && 'opacity-0'
            )}
          />
          <div className="relative z-20 mt-auto bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-6 pt-16">
            <div className="mx-auto flex max-w-md flex-col items-center gap-4">
              <div className="text-center">
                <p className="text-sm font-medium text-white">{statusLabel}</p>
                {callState === 'connected' && (
                  <span className="mt-1 inline-block text-xs text-white/70">{callDurationLabel}</span>
                )}
              </div>
              {callControls}
            </div>
          </div>
        </div>
      )}

      {/* Audio call compact bar */}
      {isCallLive && !showVideoUi && (
        <div className="fixed inset-x-3 top-4 z-[70] mx-auto max-w-sm rounded-2xl border border-white/15 bg-black/90 p-3 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white/90">{statusLabel}</p>
              {callState === 'connected' && (
                <span className="text-[11px] text-white/70">{callDurationLabel}</span>
              )}
            </div>
            {callControls}
          </div>
        </div>
      )}
    </CallContext.Provider>
  )
}
