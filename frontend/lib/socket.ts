'use client'

import { io, Socket } from 'socket.io-client'

type SocketTransport = 'websocket' | 'polling'

function socketUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SOCKET_URL?.trim()
  if (fromEnv) return fromEnv
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:3000'
}

/** Vercel rewrites proxy HTTP polling to the VPS backend, but WebSocket upgrade (wss://…) fails. */
function socketTransports(): SocketTransport[] {
  const override = process.env.NEXT_PUBLIC_SOCKET_TRANSPORTS?.trim()
  if (override) {
    return override
      .split(',')
      .map((t) => t.trim())
      .filter((t): t is SocketTransport => t === 'websocket' || t === 'polling')
  }

  const directUrl = process.env.NEXT_PUBLIC_SOCKET_URL?.trim()
  if (directUrl) return ['websocket', 'polling']

  // Same-origin proxy (e.g. Vercel + BACKEND_INTERNAL_URL): polling only.
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return ['polling']
  }

  return ['websocket', 'polling']
}

let socket: Socket | null = null

// Set while a call is ringing/connecting/connected so the tab-hidden
// auto-disconnect (below) doesn't tear down the signaling channel mid-call.
let callActive = false
export const setCallActive = (active: boolean) => {
  callActive = active
}
export const isCallActive = () => callActive

export const getSocket = (token: string | null): Socket => {
  if (socket && socket.connected) return socket
  if (!socket) {
    socket = io(socketUrl(), {
      autoConnect: false,
      withCredentials: true,
      transports: socketTransports(),
      upgrade: socketTransports().includes('websocket'),
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: { token: token ?? '' },
    })
  } else {
    socket.auth = { token: token ?? '' }
  }
  return socket
}

export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
}

/** Connect if needed; resolves when socket is ready or rejects on timeout. */
export const ensureSocketConnected = (token: string | null, timeoutMs = 8000): Promise<Socket> =>
  new Promise((resolve, reject) => {
    const s = getSocket(token)
    if (s.connected) {
      resolve(s)
      return
    }
    const timer = setTimeout(() => {
      s.off('connect', onConnect)
      s.off('connect_error', onError)
      reject(
        new Error(
          'Realtime connection unavailable — check BACKEND_INTERNAL_URL (Vercel) or backend socket port (local)'
        )
      )
    }, timeoutMs)
    const onConnect = () => {
      clearTimeout(timer)
      s.off('connect_error', onError)
      resolve(s)
    }
    const onError = (err: Error) => {
      clearTimeout(timer)
      s.off('connect', onConnect)
      reject(err)
    }
    s.once('connect', onConnect)
    s.once('connect_error', onError)
    s.connect()
  })
