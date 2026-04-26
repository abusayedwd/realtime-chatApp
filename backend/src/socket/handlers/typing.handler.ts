import { Server } from 'socket.io'
import { User } from '../../models/User.model'
import type { ChatSocket } from '../socket'

export const registerTypingHandlers = (_io: Server, socket: ChatSocket) => {
  const { userId } = socket.data

  socket.on('typing_start', async ({ conversationId }: { conversationId: string }) => {
    const user = await User.findById(userId).select('name')
    socket.to(conversationId).emit('typing', {
      userId,
      userName: user?.name ?? 'Someone',
      conversationId,
      isTyping: true,
    })
  })

  socket.on('typing_stop', ({ conversationId }: { conversationId: string }) => {
    socket.to(conversationId).emit('typing', { userId, conversationId, isTyping: false })
  })
}
