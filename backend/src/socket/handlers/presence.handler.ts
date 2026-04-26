import { Server } from 'socket.io'
import { User } from '../../models/User.model'
import type { ChatSocket } from '../socket'

export const registerPresenceHandlers = (_io: Server, socket: ChatSocket) => {
  socket.on('get_online_users', async (_: unknown, ack?: (data: { userIds: string[] }) => void) => {
    const users = await User.find({ isOnline: true }).select('_id').lean()
    ack?.({ userIds: users.map((u) => String(u._id)) })
  })
}
