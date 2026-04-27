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
  replyTo?: string
  clientTempId?: string
}

export const registerMessageHandlers = (io: Server, socket: ChatSocket) => {
  const { userId } = socket.data
  const populateMessage = (message: typeof Message.prototype) =>
    message.populate([
      { path: 'sender', select: 'name email avatar' },
      {
        path: 'replyTo',
        select: 'type content fileName isDeleted sender',
        populate: { path: 'sender', select: 'name email avatar' },
      },
    ])

  const getUnreadCount = async (conversationId: string, targetUserId: string) => {
    const uid = new mongoose.Types.ObjectId(targetUserId)
    return Message.countDocuments({
      conversationId,
      sender: { $ne: uid },
      isDeleted: false,
      deletedFor: { $nin: [uid] },
      'readBy.user': { $nin: [uid] },
    })
  }

  const emitUnreadForUser = async (conversationId: string, targetUserId: string) => {
    const count = await getUnreadCount(conversationId, targetUserId)
    io.to(`user:${targetUserId}`).emit('unread_count_updated', { conversationId, count })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket.on('join_conversation', async ({ conversationId }: { conversationId: string }, ack: any) => {
    try {
      const convo = await Conversation.findOne({
        _id: conversationId,
        participants: new mongoose.Types.ObjectId(userId),
      }).select('_id participants')
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
        replyTo,
        clientTempId,
      } = body

      if (type === 'text' && !content?.trim()) throw new Error('Empty message')
      if (type !== 'text' && !fileUrl) throw new Error('fileUrl required for non-text messages')

      const convo = await Conversation.findOne({
        _id: conversationId,
        participants: new mongoose.Types.ObjectId(userId),
      }).select('_id participants')
      if (!convo) throw new Error('Not a participant')

      if (replyTo) {
        const base = await Message.findOne({ _id: replyTo, conversationId }).select('_id')
        if (!base) throw new Error('Invalid reply target')
      }

      const message = await Message.create({
        conversationId,
        sender: userId,
        replyTo,
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

      const populated = await populateMessage(message)
      const json = populated.toJSON()

      io.to(conversationId).emit('new_message', { message: json, clientTempId })
      ;(convo.participants ?? []).forEach((pid) => {
        io.to(`user:${pid.toString()}`).emit('conversation_updated', {
          conversationId,
          lastMessage: {
            _id: json._id,
            content: json.content,
            type: json.type,
            sender: json.sender,
            createdAt: json.createdAt,
            fileName: json.fileName,
          },
          lastMessageAt: json.createdAt,
        })
      })
      await Promise.all(
        (convo.participants ?? []).map((pid) => emitUnreadForUser(conversationId, pid.toString()))
      )
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
        await emitUnreadForUser(conversationId, userId)
        ack?.({ ok: true })
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message })
      }
    }
  )

  socket.on(
    'react_message',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async ({ messageId, emoji }: { messageId: string; emoji: string }, ack: any) => {
      try {
        if (!emoji?.trim()) throw new Error('Emoji is required')

        const message = await Message.findById(messageId)
        if (!message) throw new Error('Message not found')

        const convo = await Conversation.findOne({
          _id: message.conversationId,
          participants: new mongoose.Types.ObjectId(userId),
        }).select('_id')
        if (!convo) throw new Error('Not a participant')
        if (message.isDeleted) throw new Error('Cannot react to deleted message')

        const uid = new mongoose.Types.ObjectId(userId)
        const idx = message.reactions.findIndex((r) => r.user.equals(uid))
        if (idx === -1) {
          message.reactions.push({ user: uid, emoji: emoji.trim(), createdAt: new Date() })
        } else if (message.reactions[idx].emoji === emoji.trim()) {
          message.reactions.splice(idx, 1)
        } else {
          message.reactions[idx].emoji = emoji.trim()
          message.reactions[idx].createdAt = new Date()
        }

        await message.save()
        const populated = await populateMessage(message)
        const json = populated.toJSON()
        const conversationId = String(message.conversationId)

        io.to(conversationId).emit('message_updated', { conversationId, message: json })
        ack?.({ ok: true, message: json })
      } catch (err) {
        logger.error('react_message error:', (err as Error).message)
        ack?.({ ok: false, error: (err as Error).message })
      }
    }
  )
}
