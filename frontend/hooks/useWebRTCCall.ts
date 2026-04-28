'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'

type CallType = 'audio' | 'video'
type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected'

interface IncomingCallPayload {
  fromUserId: string
  conversationId: string
  callType: CallType
}

interface CallResponsePayload {
  fromUserId: string
  conversationId: string
  accepted: boolean
  callType: CallType
  reason?: string
}

interface WebRtcOfferPayload {
  fromUserId: string
  conversationId: string
  callType: CallType
  sdp: RTCSessionDescriptionInit
}

interface WebRtcAnswerPayload {
  fromUserId: string
  conversationId: string
  sdp: RTCSessionDescriptionInit
}

interface IceCandidatePayload {
  fromUserId: string
  conversationId: string
  candidate: RTCIceCandidateInit
}

interface EndCallPayload {
  fromUserId: string
  conversationId: string
  reason?: string
}

interface StartCallParams {
  toUserId: string
  conversationId: string
  callType: CallType
}

interface UseWebRTCCallOptions {
  socket: Socket | null
}

const RING_TIMEOUT_MS = 30_000

const parseIceServers = (): RTCIceServer[] => {
  const urls = (process.env.NEXT_PUBLIC_WEBRTC_STUN_URLS ?? 'stun:stun.l.google.com:19302')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

  return urls.length > 0 ? [{ urls }] : [{ urls: ['stun:stun.l.google.com:19302'] }]
}

const emitWithAck = (socket: Socket, event: string, payload: unknown): Promise<void> =>
  new Promise((resolve, reject) => {
    socket.emit(event, payload, (res: { ok?: boolean; error?: string }) => {
      if (res?.ok) resolve()
      else reject(new Error(res?.error ?? `${event} failed`))
    })
  })

export const useWebRTCCall = ({ socket }: UseWebRTCCallOptions) => {
  const [callState, setCallState] = useState<CallState>('idle')
  const [callType, setCallType] = useState<CallType | null>(null)
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [connectedAt, setConnectedAt] = useState<number | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const callStateRef = useRef<CallState>('idle')
  const peerUserIdRef = useRef<string | null>(null)
  const conversationIdRef = useRef<string | null>(null)
  const outgoingCallRef = useRef<StartCallParams | null>(null)
  const pendingOfferRef = useRef<WebRtcOfferPayload | null>(null)
  const incomingAcceptedRef = useRef(false)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const iceServers = useMemo(() => parseIceServers(), [])

  const stopLocalTracks = useCallback(() => {
    if (!localStream) return
    localStream.getTracks().forEach((track) => track.stop())
    setLocalStream(null)
    setIsMuted(false)
    setIsCameraOff(false)
  }, [localStream])

  useEffect(() => {
    callStateRef.current = callState
  }, [callState])

  const cleanupPeer = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null
      pcRef.current.ontrack = null
      pcRef.current.onconnectionstatechange = null
      pcRef.current.close()
      pcRef.current = null
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop())
      remoteStreamRef.current = null
      setRemoteStream(null)
    }
    peerUserIdRef.current = null
    conversationIdRef.current = null
    pendingOfferRef.current = null
    incomingAcceptedRef.current = false
    outgoingCallRef.current = null
    setConnectedAt(null)
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current)
      ringTimeoutRef.current = null
    }
  }, [])

  const ensureMedia = useCallback(
    async (kind: CallType) => {
      if (localStream) return localStream
      if (typeof navigator === 'undefined') {
        throw new Error('Media devices are unavailable in this environment')
      }
      const getUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)
      if (!getUserMedia) {
        throw new Error(
          'Camera/microphone unavailable. Use HTTPS (or localhost) and allow browser permissions.'
        )
      }
      if (!window.isSecureContext) {
        throw new Error('Audio/Video calls require HTTPS or localhost')
      }
      const stream = await getUserMedia({
        audio: true,
        video: kind === 'video',
      })
      setLocalStream(stream)
      return stream
    },
    [localStream]
  )

  const buildPeerConnection = useCallback(
    (peerUserId: string, conversationId: string, kind: CallType) => {
      const pc = new RTCPeerConnection({ iceServers })
      pcRef.current = pc
      peerUserIdRef.current = peerUserId
      conversationIdRef.current = conversationId

      pc.onicecandidate = (event) => {
        if (!socket || !event.candidate || !peerUserIdRef.current || !conversationIdRef.current) return
        void emitWithAck(socket, 'webrtc_ice_candidate', {
          toUserId: peerUserIdRef.current,
          conversationId: conversationIdRef.current,
          candidate: event.candidate.toJSON(),
        }).catch((err) => setError((err as Error).message))
      }

      pc.ontrack = (event) => {
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream()
        }
        event.streams[0]?.getTracks().forEach((track) => remoteStreamRef.current?.addTrack(track))
        setRemoteStream(remoteStreamRef.current)
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setCallState('connected')
          setConnectedAt(Date.now())
        }
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          setCallState('idle')
          cleanupPeer()
          stopLocalTracks()
        }
      }

      return ensureMedia(kind).then((stream) => {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream))
        return pc
      })
    },
    [cleanupPeer, ensureMedia, iceServers, socket, stopLocalTracks]
  )

  const endCallLocal = useCallback(() => {
    setCallState('idle')
    setIncomingCall(null)
    setCallType(null)
    cleanupPeer()
    stopLocalTracks()
  }, [cleanupPeer, stopLocalTracks])

  const startCall = useCallback(
    async ({ toUserId, conversationId, callType: kind }: StartCallParams) => {
      if (!socket) throw new Error('Socket not connected')
      setError(null)
      setCallType(kind)
      setCallState('calling')
      peerUserIdRef.current = toUserId
      conversationIdRef.current = conversationId
      outgoingCallRef.current = { toUserId, conversationId, callType: kind }
      await emitWithAck(socket, 'call_user', { toUserId, conversationId, callType: kind })
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current)
      ringTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'calling') {
          if (peerUserIdRef.current && conversationIdRef.current) {
            void emitWithAck(socket, 'call_end', {
              toUserId: peerUserIdRef.current,
              conversationId: conversationIdRef.current,
              reason: 'no-answer',
            }).catch((err) => setError((err as Error).message))
          }
          endCallLocal()
        }
      }, RING_TIMEOUT_MS)
    },
    [endCallLocal, socket]
  )

  const acceptIncomingCall = useCallback(async () => {
    if (!socket || !incomingCall) return
    setError(null)
    setCallType(incomingCall.callType)
    setCallState('connecting')
    incomingAcceptedRef.current = true
    await emitWithAck(socket, 'call_response', {
      toUserId: incomingCall.fromUserId,
      conversationId: incomingCall.conversationId,
      accepted: true,
      callType: incomingCall.callType,
    })
    const offer = pendingOfferRef.current
    if (offer) {
      const pc = await buildPeerConnection(offer.fromUserId, offer.conversationId, offer.callType)
      await pc.setRemoteDescription(new RTCSessionDescription(offer.sdp))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await emitWithAck(socket, 'webrtc_answer', {
        toUserId: offer.fromUserId,
        conversationId: offer.conversationId,
        sdp: answer,
      })
      pendingOfferRef.current = null
      incomingAcceptedRef.current = false
    }
    setIncomingCall(null)
  }, [buildPeerConnection, incomingCall, socket])

  const rejectIncomingCall = useCallback(async () => {
    if (!socket || !incomingCall) return
    await emitWithAck(socket, 'call_response', {
      toUserId: incomingCall.fromUserId,
      conversationId: incomingCall.conversationId,
      accepted: false,
      callType: incomingCall.callType,
      reason: 'rejected-by-user',
    })
    setIncomingCall(null)
    incomingAcceptedRef.current = false
    setCallState('idle')
    setCallType(null)
  }, [incomingCall, socket])

  const endCall = useCallback(async () => {
    if (socket && peerUserIdRef.current && conversationIdRef.current) {
      const reason = callState === 'calling' || callState === 'ringing' ? 'no-answer' : 'ended'
      await emitWithAck(socket, 'call_end', {
        toUserId: peerUserIdRef.current,
        conversationId: conversationIdRef.current,
        reason,
      }).catch((err) => setError((err as Error).message))
    }
    endCallLocal()
  }, [callState, endCallLocal, socket])

  const toggleMute = useCallback(() => {
    if (!localStream) return
    const audioTracks = localStream.getAudioTracks()
    if (audioTracks.length === 0) return
    const shouldMute = !isMuted
    audioTracks.forEach((track) => {
      track.enabled = !shouldMute
    })
    setIsMuted(shouldMute)
  }, [isMuted, localStream])

  const toggleCamera = useCallback(() => {
    if (!localStream) return
    const videoTracks = localStream.getVideoTracks()
    if (videoTracks.length === 0) return
    const shouldTurnOff = !isCameraOff
    videoTracks.forEach((track) => {
      track.enabled = !shouldTurnOff
    })
    setIsCameraOff(shouldTurnOff)
  }, [isCameraOff, localStream])

  useEffect(() => {
    if (!socket) return

    const onIncomingCall = (payload: IncomingCallPayload) => {
      if (callStateRef.current !== 'idle') {
        void emitWithAck(socket, 'call_response', {
          toUserId: payload.fromUserId,
          conversationId: payload.conversationId,
          accepted: false,
          callType: payload.callType,
          reason: 'busy',
        }).catch((err) => setError((err as Error).message))
        return
      }
      setIncomingCall(payload)
      setCallType(payload.callType)
      setCallState('ringing')
      peerUserIdRef.current = payload.fromUserId
      conversationIdRef.current = payload.conversationId
      incomingAcceptedRef.current = false
      pendingOfferRef.current = null
    }

    const onCallResponse = async (payload: CallResponsePayload) => {
      if (!payload.accepted) {
        const reason = payload.reason ?? 'rejected'
        const message =
          reason === 'busy'
            ? 'User is busy on another call'
            : reason === 'no-answer'
              ? 'No answer from receiver'
              : reason === 'rejected-by-user' || reason === 'rejected'
                ? 'Call rejected'
                : reason === 'disconnected'
                  ? 'Call disconnected'
                  : `Call ended: ${reason}`
        setError(message)
        endCallLocal()
        return
      }
      if (!outgoingCallRef.current) return
      const active = outgoingCallRef.current
      if (
        active.toUserId !== payload.fromUserId ||
        active.conversationId !== payload.conversationId ||
        active.callType !== payload.callType
      ) {
        return
      }

      setCallState('connecting')
      const pc = await buildPeerConnection(active.toUserId, active.conversationId, active.callType)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await emitWithAck(socket, 'webrtc_offer', {
        toUserId: active.toUserId,
        conversationId: active.conversationId,
        callType: active.callType,
        sdp: offer,
      })
    }

    const onWebRtcOffer = (payload: WebRtcOfferPayload) => {
      pendingOfferRef.current = payload
      if (!incomingAcceptedRef.current) return
      void (async () => {
        const pc = await buildPeerConnection(payload.fromUserId, payload.conversationId, payload.callType)
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await emitWithAck(socket, 'webrtc_answer', {
          toUserId: payload.fromUserId,
          conversationId: payload.conversationId,
          sdp: answer,
        })
        pendingOfferRef.current = null
        incomingAcceptedRef.current = false
      })().catch((err) => setError((err as Error).message))
    }

    const onWebRtcAnswer = async (payload: WebRtcAnswerPayload) => {
      if (!pcRef.current) return
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp))
    }

    const onIceCandidate = async (payload: IceCandidatePayload) => {
      if (!pcRef.current) return
      await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate))
    }

    const onCallEnded = (payload: EndCallPayload) => {
      if (payload.reason === 'disconnected') {
        setError('Peer disconnected')
      }
      endCallLocal()
    }

    const onCallResponseSafe = (payload: CallResponsePayload) => {
      void onCallResponse(payload).catch((err) => setError((err as Error).message))
    }
    const onWebRtcAnswerSafe = (payload: WebRtcAnswerPayload) => {
      void onWebRtcAnswer(payload).catch((err) => setError((err as Error).message))
    }
    const onIceCandidateSafe = (payload: IceCandidatePayload) => {
      void onIceCandidate(payload).catch((err) => setError((err as Error).message))
    }

    socket.on('incoming_call', onIncomingCall)
    socket.on('call_response', onCallResponseSafe)
    socket.on('webrtc_offer', onWebRtcOffer)
    socket.on('webrtc_answer', onWebRtcAnswerSafe)
    socket.on('webrtc_ice_candidate', onIceCandidateSafe)
    socket.on('call_ended', onCallEnded)

    return () => {
      socket.off('incoming_call', onIncomingCall)
      socket.off('call_response', onCallResponseSafe)
      socket.off('webrtc_offer', onWebRtcOffer)
      socket.off('webrtc_answer', onWebRtcAnswerSafe)
      socket.off('webrtc_ice_candidate', onIceCandidateSafe)
      socket.off('call_ended', onCallEnded)
    }
  }, [buildPeerConnection, endCallLocal, socket])

  useEffect(() => {
    return () => {
      endCallLocal()
    }
  }, [endCallLocal])

  return {
    callState,
    callType,
    incomingCall,
    error,
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
  }
}
