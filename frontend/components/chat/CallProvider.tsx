'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch'
import { getSocket } from '@/lib/socket'
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
  const call = useWebRTCCall({ socket })
  const {
    callState,
    callType,
    incomingCall,
    error: callError,
    remoteStream,
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

  const { data: callConversation } = useGetConversationQuery(incomingCall?.conversationId ?? '', {
    skip: !incomingCall,
  })
  const caller = callConversation?.participants.find((p) => p._id === incomingCall?.fromUserId)

  useRingtone(callState === 'ringing' && Boolean(incomingCall))

  useEffect(() => {
    if (!callError) return
    dispatch(pushToast(toast.error(callError)))
  }, [callError, dispatch])

  useEffect(() => {
    if (!remoteAudioRef.current) return
    remoteAudioRef.current.srcObject = callType === 'audio' ? (remoteStream ?? null) : null
    if (remoteStream) {
      // Explicit play() call — assigning srcObject alone can silently fail to
      // autoplay on mobile browsers even with the `autoPlay` attribute set.
      remoteAudioRef.current.play().catch(() => {})
    }
  }, [callType, remoteStream])

  const isCallLive = callState === 'connected' || callState === 'connecting' || callState === 'calling'

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

  return (
    <CallContext.Provider value={call}>
      {children}

      {incomingCall && callState === 'ringing' && (
        <div className="fixed inset-x-3 top-4 z-[70] mx-auto max-w-sm rounded-2xl border border-white/15 bg-bg-panel/95 p-4 shadow-2xl backdrop-blur">
          <p className="text-sm font-semibold text-ink">{caller?.name ?? 'Someone'} is calling...</p>
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

      {isCallLive && (
        <div className="fixed inset-x-3 top-4 z-[70] mx-auto max-w-sm rounded-2xl border border-white/15 bg-black/90 p-3 shadow-2xl backdrop-blur">
          <audio ref={remoteAudioRef} autoPlay playsInline />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-white/90">
              {callState === 'calling' && `Calling ${caller?.name ?? 'user'}...`}
              {callState === 'connecting' && 'Connecting call...'}
              {callState === 'connected' &&
                `${callType === 'video' ? 'Video' : 'Audio'} call with ${caller?.name ?? 'user'}`}
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
                onClick={() => void endCall()}
                className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-rose-500"
              >
                End
              </button>
            </div>
          </div>
        </div>
      )}
    </CallContext.Provider>
  )
}
