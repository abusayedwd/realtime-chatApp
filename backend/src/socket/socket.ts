import { Server, Socket } from 'socket.io'
import type { Server as HttpServer } from 'http'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { User } from '../models/User.model'
import { Conversation } from '../models/Conversation.model'
import { logger } from '../utils/logger'
import { registerMessageHandlers } from './handlers/message.handler'
import { registerTypingHandlers } from './handlers/typing.handler'
import { registerPresenceHandlers } from './handlers/presence.handler'
import { registerCallHandlers } from './handlers/call.handler'

export interface SocketData {
  userId: string
  email: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEvents = Record<string, (...args: any[]) => void>

export type ChatSocket = Socket<AnyEvents, AnyEvents, AnyEvents, SocketData>

let ioInstance: Server | null = null
export const getIO = () => ioInstance

export const initSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true)
        if (env.NODE_ENV === 'development') return callback(null, true)
        if (origin === env.CLIENT_URL) return callback(null, true)
        callback(new Error(`CORS: origin ${origin} not allowed`))
      },
      credentials: true,
    },
    pingTimeout: 60_000,
    pingInterval: 25_000,
    maxHttpBufferSize: 1e6,
  })

  // JWT auth middleware
  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.headers.authorization?.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.slice(7)
          : undefined)

      if (!token) return next(new Error('Authentication required'))
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as { userId: string; email: string }
      socket.data.userId = decoded.userId
      socket.data.email = decoded.email
      next()
    } catch {
      next(new Error('Authentication failed'))
    }
  })

  io.on('connection', async (socket: ChatSocket) => {
    const { userId } = socket.data
    logger.info(`Socket connected: ${socket.id} (user=${userId})`)

    // Personal room — lets us target a single user across tabs
    socket.join(`user:${userId}`)

    // Mark online + broadcast presence
    await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() })
    socket.broadcast.emit('user_online', { userId })

    // Join all conversation rooms this user belongs to
    const conversations = await Conversation.find({ participants: userId }).select('_id').lean()
    conversations.forEach((c) => socket.join(String(c._id)))

    registerMessageHandlers(io, socket)
    registerTypingHandlers(io, socket)
    registerPresenceHandlers(io, socket)
    registerCallHandlers(io, socket)

    socket.on('disconnect', async (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (${reason})`)

      // Only mark offline when the user has no remaining sockets connected
      const remaining = await io.in(`user:${userId}`).fetchSockets()
      if (remaining.length === 0) {
        const lastSeen = new Date()
        await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen })
        io.emit('user_offline', { userId, lastSeen })
      }
    })
  })

  ioInstance = io
  return io
}
