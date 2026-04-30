'use client'

import { io, Socket } from 'socket.io-client'

function socketUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SOCKET_URL?.trim()
  if (fromEnv) return fromEnv
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:3000'
}

let socket: Socket | null = null

export const getSocket = (token: string | null): Socket => {
  if (socket && socket.connected) return socket
  if (!socket) {
    socket = io(socketUrl(), {
      autoConnect: false,
      withCredentials: true,
      transports: ['websocket', 'polling'],
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
