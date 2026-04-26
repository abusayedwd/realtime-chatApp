import { Server } from 'socket.io'
import mongoose from 'mongoose'
import { Message } from '../../models/Message.model'
import { Conversation } from '../../models/Conversation.model'
import { logger } from '../../utils/logger'
import type { ChatSocket } from '../socket'

interface SendMessageBody {
  conversationId: string
  type?: 'text' | 'image' | 'video' | 'file'
  content?: string
  fileUrl?: string
  fileName?: string
  fileSize?: number
  mimeType?: string
  thumbnailUrl?: string
  clientTempId?: string
}

export const registerMessageHandlers = (io: Server, socket: ChatSocket) => {
  const { userId } = socket.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket.on('join_conversation', async ({ conversationId }: { conversationId: string }, ack: any) => {
    try {
      const convo = await Conversation.findOne({
        _id: conversationId,
        participants: new mongoose.Types.ObjectId(userId),
      }).select('_id')
      if (!convo) throw new Error('Not a participant')
      socket.join(conversationId)
      ack?.({ ok: true })
    } catch (err) {
      ack?.({ ok: false, error: (err as Error).message })
    }
  })

  socket.on('leave_conversation', ({ conversationId }: { conversationId: string }) => {
    socket.leave(conversationId)
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket.on('send_message', async (body: SendMessageBody, ack: any) => {
    try {
      const {
        conversationId,
        type = 'text',
        content,
        fileUrl,
        fileName,
        fileSize,
        mimeType,
        thumbnailUrl,
        clientTempId,
      } = body

      if (type === 'text' && !content?.trim()) throw new Error('Empty message')
      if (type !== 'text' && !fileUrl) throw new Error('fileUrl required for non-text messages')

      const convo = await Conversation.findOne({
        _id: conversationId,
        participants: new mongoose.Types.ObjectId(userId),
      }).select('_id')
      if (!convo) throw new Error('Not a participant')

      const message = await Message.create({
        conversationId,
        sender: userId,
        type,
        content,
        fileUrl,
        fileName,
        fileSize,
        mimeType,
        thumbnailUrl,
        readBy: [{ user: userId, readAt: new Date() }],
      })

      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: message._id,
        lastMessageAt: new Date(),
      })

      const populated = await message.populate('sender', 'name email avatar')
      const json = populated.toJSON()

      io.to(conversationId).emit('new_message', { message: json, clientTempId })
      ack?.({ ok: true, message: json, clientTempId })
    } catch (err) {
      logger.error('send_message error:', (err as Error).message)
      ack?.({ ok: false, error: (err as Error).message, clientTempId: body.clientTempId })
    }
  })

  socket.on(
    'message_read',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (
      { conversationId, messageIds }: { conversationId: string; messageIds: string[] },
      ack: any
    ) => {
      try {
        if (!Array.isArray(messageIds) || messageIds.length === 0) throw new Error('No messageIds')
        const uid = new mongoose.Types.ObjectId(userId)

        await Message.updateMany(
          {
            _id: { $in: messageIds },
            conversationId,
            sender: { $ne: uid },
            'readBy.user': { $nin: [uid] },
          },
          { $push: { readBy: { user: uid, readAt: new Date() } } }
        )

        io.to(conversationId).emit('messages_read', { conversationId, messageIds, readBy: userId })
        ack?.({ ok: true })
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message })
      }
    }
  )
}
