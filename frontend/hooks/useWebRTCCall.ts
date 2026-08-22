'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { ensureSocketConnected, setCallActive } from '@/lib/socket'

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
  accessToken: string | null
}

const RING_TIMEOUT_MS = 30_000
const CONNECT_TIMEOUT_MS = 30_000

const parseIceServers = (): RTCIceServer[] => {
  const stunUrls = (
    process.env.NEXT_PUBLIC_WEBRTC_STUN_URLS ??
    'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302'
  )
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

  const servers: RTCIceServer[] = []
  if (stunUrls.length > 0) servers.push({ urls: stunUrls })

  const turnUrls = (process.env.NEXT_PUBLIC_WEBRTC_TURN_URLS ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

  if (turnUrls.length > 0) {
    const username = process.env.NEXT_PUBLIC_WEBRTC_TURN_USERNAME?.trim()
    const credential = process.env.NEXT_PUBLIC_WEBRTC_TURN_CREDENTIAL?.trim()
    servers.push({
      urls: turnUrls,
      ...(username && credential ? { username, credential } : {}),
    })
  }

  return servers.length > 0 ? servers : [{ urls: ['stun:stun.l.google.com:19302'] }]
}

const ICE_FAIL_MSG =
  'Call connection failed — users on different networks/mobile need TURN (NEXT_PUBLIC_WEBRTC_TURN_* env vars)'

const emitWithAck = (socket: Socket, event: string, payload: unknown, timeoutMs = 15_000): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} timed out — socket may still be connecting`)), timeoutMs)
    socket.emit(event, payload, (res: { ok?: boolean; error?: string }) => {
      clearTimeout(timer)
      if (res?.ok) resolve()
      else reject(new Error(res?.error ?? `${event} failed`))
    })
  })

export const useWebRTCCall = ({ socket, accessToken }: UseWebRTCCallOptions) => {
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
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerUserIdRef = useRef<string | null>(null)
  const conversationIdRef = useRef<string | null>(null)
  const outgoingCallRef = useRef<StartCallParams | null>(null)
  const pendingOfferRef = useRef<WebRtcOfferPayload | null>(null)
  const incomingAcceptedRef = useRef(false)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([])
  const remoteDescriptionSetRef = useRef(false)
  const answeringOfferRef = useRef(false)
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [peerUserId, setPeerUserId] = useState<string | null>(null)

  const iceServers = useMemo(() => parseIceServers(), [])

  const requireSocket = useCallback(async (): Promise<Socket> => {
    if (!accessToken) throw new Error('Not authenticated — log in again')
    return ensureSocketConnected(accessToken, 12_000)
  }, [accessToken])

  const stopLocalTracks = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    stream.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    setLocalStream(null)
    setIsMuted(false)
    setIsCameraOff(false)
  }, [])

  useEffect(() => {
    callStateRef.current = callState
  }, [callState])

  const cleanupPeer = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null
      pcRef.current.ontrack = null
      pcRef.current.onconnectionstatechange = null
      pcRef.current.oniceconnectionstatechange = null
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
    pendingIceCandidatesRef.current = []
    remoteDescriptionSetRef.current = false
    incomingAcceptedRef.current = false
    answeringOfferRef.current = false
    outgoingCallRef.current = null
    setActiveConversationId(null)
    setPeerUserId(null)
    setConnectedAt(null)
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current)
      ringTimeoutRef.current = null
    }
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current)
      connectTimeoutRef.current = null
    }
  }, [])

  const ensureMedia = useCallback(
    async (kind: CallType) => {
      if (localStreamRef.current) return localStreamRef.current
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
      try {
        const stream = await getUserMedia({
          audio: true,
          video: kind === 'video',
        })
        localStreamRef.current = stream
        setLocalStream(stream)
        return stream
      } catch (err) {
        const name = (err as DOMException).name
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          throw new Error('Microphone/camera blocked — allow access in browser settings and reload')
        }
        if (name === 'NotFoundError') {
          throw new Error(kind === 'video' ? 'No camera found on this device' : 'No microphone found')
        }
        throw err
      }
    },
    []
  )

  const flushIceCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const pending = pendingIceCandidatesRef.current
    pendingIceCandidatesRef.current = []
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch {
        /* ignore stale candidates */
      }
    }
  }, [])

  const applyRemoteDescription = useCallback(
    async (pc: RTCPeerConnection, sdp: RTCSessionDescriptionInit) => {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      remoteDescriptionSetRef.current = true
      await flushIceCandidates(pc)
    },
    [flushIceCandidates]
  )

  const endCallLocal = useCallback(() => {
    setCallState('idle')
    setIncomingCall(null)
    setCallType(null)
    cleanupPeer()
    stopLocalTracks()
    setCallActive(false)
  }, [cleanupPeer, stopLocalTracks])

  const notifyPeerCallEnd = useCallback(
    (reason: string) => {
      if (!peerUserIdRef.current || !conversationIdRef.current) return
      void requireSocket()
        .then((liveSocket) =>
          emitWithAck(liveSocket, 'call_end', {
            toUserId: peerUserIdRef.current,
            conversationId: conversationIdRef.current,
            reason,
          })
        )
        .catch((err) => setError((err as Error).message))
    },
    [requireSocket]
  )

  const clearConnectTimeout = useCallback(() => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current)
      connectTimeoutRef.current = null
    }
  }, [])

  const markConnected = useCallback(() => {
    if (callStateRef.current === 'connected') return
    clearConnectTimeout()
    setCallState('connected')
    setConnectedAt(Date.now())
  }, [clearConnectTimeout])

  const startConnectTimeout = useCallback(() => {
    clearConnectTimeout()
    connectTimeoutRef.current = setTimeout(() => {
      if (callStateRef.current === 'connecting') {
        setError('Call timed out while connecting — allow mic access and reload both tabs')
        notifyPeerCallEnd('connection-timeout')
        endCallLocal()
      }
    }, CONNECT_TIMEOUT_MS)
  }, [clearConnectTimeout, endCallLocal, notifyPeerCallEnd])

  const buildPeerConnection = useCallback(
    (peerId: string, conversationId: string, kind: CallType) => {
      const pc = new RTCPeerConnection({ iceServers })
      pcRef.current = pc
      peerUserIdRef.current = peerId
      conversationIdRef.current = conversationId
      setPeerUserId(peerId)
      setActiveConversationId(conversationId)
      pendingIceCandidatesRef.current = []
      remoteDescriptionSetRef.current = false

      pc.onicecandidate = (event) => {
        if (!event.candidate || !peerUserIdRef.current || !conversationIdRef.current) return
        void requireSocket()
          .then((liveSocket) =>
            emitWithAck(liveSocket, 'webrtc_ice_candidate', {
              toUserId: peerUserIdRef.current,
              conversationId: conversationIdRef.current,
              candidate: event.candidate!.toJSON(),
            })
          )
          .catch((err) => setError((err as Error).message))
      }

      pc.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track])
        remoteStreamRef.current = stream
        setRemoteStream(stream)
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') markConnected()
        if (pc.connectionState === 'failed') {
          setError(ICE_FAIL_MSG)
          notifyPeerCallEnd('connection-failed')
          endCallLocal()
        }
      }

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          markConnected()
        }
        if (pc.iceConnectionState === 'failed') {
          setError(ICE_FAIL_MSG)
          notifyPeerCallEnd('connection-failed')
          endCallLocal()
        }
      }

      return ensureMedia(kind).then((stream) => {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream))
        return pc
      })
    },
    [endCallLocal, ensureMedia, iceServers, markConnected, notifyPeerCallEnd, requireSocket]
  )

  const answerIncomingOffer = useCallback(
    async (offer: WebRtcOfferPayload) => {
      if (answeringOfferRef.current || pcRef.current) return
      answeringOfferRef.current = true
      try {
        const liveSocket = await requireSocket()
        const pc = await buildPeerConnection(offer.fromUserId, offer.conversationId, offer.callType)
        await applyRemoteDescription(pc, offer.sdp)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await emitWithAck(liveSocket, 'webrtc_answer', {
          toUserId: offer.fromUserId,
          conversationId: offer.conversationId,
          sdp: answer,
        })
        pendingOfferRef.current = null
      } finally {
        answeringOfferRef.current = false
      }
    },
    [applyRemoteDescription, buildPeerConnection, requireSocket]
  )

  const startCall = useCallback(
    async ({ toUserId, conversationId, callType: kind }: StartCallParams) => {
      setError(null)
      setCallType(kind)
      setCallState('calling')
      setCallActive(true)
      peerUserIdRef.current = toUserId
      conversationIdRef.current = conversationId
      setPeerUserId(toUserId)
      setActiveConversationId(conversationId)
      outgoingCallRef.current = { toUserId, conversationId, callType: kind }
      const liveSocket = await requireSocket()
      await emitWithAck(liveSocket, 'call_user', { toUserId, conversationId, callType: kind })
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current)
      ringTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'calling') {
          if (peerUserIdRef.current && conversationIdRef.current) {
            void requireSocket()
              .then((s) =>
                emitWithAck(s, 'call_end', {
                  toUserId: peerUserIdRef.current,
                  conversationId: conversationIdRef.current,
                  reason: 'no-answer',
                })
              )
              .catch((err) => setError((err as Error).message))
          }
          endCallLocal()
        }
      }, RING_TIMEOUT_MS)
    },
    [endCallLocal, requireSocket]
  )

  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall) return
    setError(null)
    setCallType(incomingCall.callType)
    setCallState('connecting')
    setCallActive(true)
    startConnectTimeout()
    incomingAcceptedRef.current = true
    const liveSocket = await requireSocket()
    await emitWithAck(liveSocket, 'call_response', {
      toUserId: incomingCall.fromUserId,
      conversationId: incomingCall.conversationId,
      accepted: true,
      callType: incomingCall.callType,
    })
    setIncomingCall(null)
    const offer = pendingOfferRef.current
    if (offer) await answerIncomingOffer(offer)
  }, [answerIncomingOffer, incomingCall, requireSocket, startConnectTimeout])

  const rejectIncomingCall = useCallback(async () => {
    if (!incomingCall) return
    const liveSocket = await requireSocket()
    await emitWithAck(liveSocket, 'call_response', {
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
    setCallActive(false)
  }, [incomingCall, requireSocket])

  const endCall = useCallback(async () => {
    if (peerUserIdRef.current && conversationIdRef.current) {
      const reason = callState === 'calling' || callState === 'ringing' ? 'no-answer' : 'ended'
      try {
        const liveSocket = await requireSocket()
        await emitWithAck(liveSocket, 'call_end', {
          toUserId: peerUserIdRef.current,
          conversationId: conversationIdRef.current,
          reason,
        })
      } catch (err) {
        setError((err as Error).message)
      }
    }
    endCallLocal()
  }, [callState, endCallLocal, requireSocket])

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) return
    const shouldMute = !isMuted
    audioTracks.forEach((track) => {
      track.enabled = !shouldMute
    })
    setIsMuted(shouldMute)
  }, [isMuted])

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const videoTracks = stream.getVideoTracks()
    if (videoTracks.length === 0) return
    const shouldTurnOff = !isCameraOff
    videoTracks.forEach((track) => {
      track.enabled = !shouldTurnOff
    })
    setIsCameraOff(shouldTurnOff)
  }, [isCameraOff])

  useEffect(() => {
    if (!socket) return

    const onIncomingCall = (payload: IncomingCallPayload) => {
      if (callStateRef.current !== 'idle') {
        void requireSocket()
          .then((liveSocket) =>
            emitWithAck(liveSocket, 'call_response', {
              toUserId: payload.fromUserId,
              conversationId: payload.conversationId,
              accepted: false,
              callType: payload.callType,
              reason: 'busy',
            })
          )
          .catch((err) => setError((err as Error).message))
        return
      }
      setCallActive(true)
      setIncomingCall(payload)
      setCallType(payload.callType)
      setCallState('ringing')
      peerUserIdRef.current = payload.fromUserId
      conversationIdRef.current = payload.conversationId
      setPeerUserId(payload.fromUserId)
      setActiveConversationId(payload.conversationId)
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
      startConnectTimeout()
      const liveSocket = await requireSocket()
      const pc = await buildPeerConnection(active.toUserId, active.conversationId, active.callType)
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: active.callType === 'video' })
      await pc.setLocalDescription(offer)
      await emitWithAck(liveSocket, 'webrtc_offer', {
        toUserId: active.toUserId,
        conversationId: active.conversationId,
        callType: active.callType,
        sdp: offer,
      })
    }

    const onWebRtcOffer = (payload: WebRtcOfferPayload) => {
      pendingOfferRef.current = payload
      const shouldAnswer =
        incomingAcceptedRef.current ||
        callStateRef.current === 'connecting' ||
        callStateRef.current === 'connected'
      if (!shouldAnswer) return
      void answerIncomingOffer(payload).catch((err) => {
        setError((err as Error).message)
        endCallLocal()
      })
    }

    const onWebRtcAnswer = async (payload: WebRtcAnswerPayload) => {
      if (!pcRef.current) return
      await applyRemoteDescription(pcRef.current, payload.sdp)
    }

    const onIceCandidate = async (payload: IceCandidatePayload) => {
      if (!pcRef.current) return
      if (!remoteDescriptionSetRef.current) {
        pendingIceCandidatesRef.current.push(payload.candidate)
        return
      }
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate))
      } catch {
        /* ignore stale candidates */
      }
    }

    const onCallEnded = (payload: EndCallPayload) => {
      if (payload.reason === 'disconnected') {
        setError('Peer disconnected')
      }
      endCallLocal()
    }

    const onCallResponseSafe = (payload: CallResponsePayload) => {
      void onCallResponse(payload).catch((err) => {
        setError((err as Error).message)
        endCallLocal()
      })
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
  }, [answerIncomingOffer, buildPeerConnection, endCallLocal, requireSocket, socket, startConnectTimeout])

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
    activeConversationId,
    peerUserId,
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
