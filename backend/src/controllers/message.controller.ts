import { Request, Response } from 'express'
import mongoose from 'mongoose'
import { asyncHandler } from '../utils/asyncHandler'
import { sendSuccess, sendCreated } from '../utils/ApiResponse'
import { ApiError } from '../utils/ApiError'
import { Conversation } from '../models/Conversation.model'
import { Message } from '../models/Message.model'
import { uploadBufferToCloudinary } from '../services/file.service'
import { getIO } from '../socket/socket'

const MESSAGE_POPULATE = [
  { path: 'sender', select: 'name email avatar' },
  {
    path: 'replyTo',
    select: 'type content fileName isDeleted sender',
    populate: { path: 'sender', select: 'name email avatar' },
  },
]

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

const emitUnreadForUser = async (
  conversationId: string,
  targetUserId: string
) => {
  const io = getIO()
  if (!io) return
  const count = await getUnreadCount(conversationId, targetUserId)
  io.to(`user:${targetUserId}`).emit('unread_count_updated', { conversationId, count })
}

const assertParticipant = async (conversationId: string, userId: string) => {
  const convo = await Conversation.findOne({
    _id: conversationId,
    participants: new mongoose.Types.ObjectId(userId),
  })
  if (!convo) throw new ApiError(403, 'You are not a participant in this conversation')
  return convo
}

export const getMessages = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const { conversationId } = req.params
  const page = Number(req.query.page ?? 1)
  const limit = Number(req.query.limit ?? 30)

  await assertParticipant(conversationId, userId)

  const filter: Record<string, unknown> = {
    conversationId,
    deletedFor: { $nin: [new mongoose.Types.ObjectId(userId)] },
  }

  const [items, total] = await Promise.all([
    Message.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(MESSAGE_POPULATE)
      .lean(),
    Message.countDocuments(filter),
  ])

  return sendSuccess(
    res,
    items.reverse(), // chronological order for the UI
    'OK',
    200,
    { page, limit, total, hasMore: page * limit < total }
  )
})

export const sendTextMessage = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const { conversationId } = req.params
  const { type, content, fileUrl, fileName, fileSize, mimeType, thumbnailUrl, replyTo } = req.body

  if (type === 'text' && !content?.trim()) {
    throw new ApiError(400, 'Message content cannot be empty')
  }
  if (type !== 'text' && !fileUrl) {
    throw new ApiError(400, 'File URL is required for non-text messages')
  }

  const convo = await assertParticipant(conversationId, userId)

  if (replyTo) {
    const base = await Message.findOne({ _id: replyTo, conversationId }).select('_id')
    if (!base) throw new ApiError(400, 'Invalid reply target')
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

  const populated = await message.populate(MESSAGE_POPULATE)

  const io = getIO()
  if (io) io.to(conversationId).emit('new_message', { message: populated.toJSON() })
  await Promise.all(convo.participants.map((pid) => emitUnreadForUser(conversationId, pid.toString())))

  return sendCreated(res, populated.toJSON(), 'Message sent')
})

export const uploadAndSend = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const { conversationId } = req.params
  const replyTo = typeof req.body?.replyTo === 'string' ? req.body.replyTo : undefined

  if (!req.file) throw new ApiError(400, 'No file provided')
  const convo = await assertParticipant(conversationId, userId)

  if (replyTo) {
    const base = await Message.findOne({ _id: replyTo, conversationId }).select('_id')
    if (!base) throw new ApiError(400, 'Invalid reply target')
  }

  const uploaded = await uploadBufferToCloudinary(req.file.buffer, req.file)

  const type: 'image' | 'video' | 'file' = uploaded.mimeType.startsWith('image/')
    ? 'image'
    : uploaded.mimeType.startsWith('video/')
      ? 'video'
      : 'file'

  const message = await Message.create({
    conversationId,
    sender: userId,
    replyTo,
    type,
    fileUrl: uploaded.url,
    fileName: uploaded.originalName,
    fileSize: uploaded.bytes,
    mimeType: uploaded.mimeType,
    thumbnailUrl: uploaded.thumbnailUrl,
    readBy: [{ user: userId, readAt: new Date() }],
  })

  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessage: message._id,
    lastMessageAt: new Date(),
  })

  const populated = await message.populate(MESSAGE_POPULATE)

  const io = getIO()
  if (io) io.to(conversationId).emit('new_message', { message: populated.toJSON() })
  await Promise.all(convo.participants.map((pid) => emitUnreadForUser(conversationId, pid.toString())))

  return sendCreated(res, populated.toJSON(), 'File uploaded and message sent')
})

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const { conversationId } = req.params
  const { messageIds } = req.body as { messageIds: string[] }

  await assertParticipant(conversationId, userId)

  await Message.updateMany(
    {
      _id: { $in: messageIds },
      conversationId,
      sender: { $ne: new mongoose.Types.ObjectId(userId) },
      'readBy.user': { $nin: [new mongoose.Types.ObjectId(userId)] },
    },
    { $push: { readBy: { user: new mongoose.Types.ObjectId(userId), readAt: new Date() } } }
  )

  const io = getIO()
  if (io) io.to(conversationId).emit('messages_read', { conversationId, messageIds, readBy: userId })
  await emitUnreadForUser(conversationId, userId)

  return sendSuccess(res, { messageIds }, 'Messages marked as read')
})

export const deleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const { messageId } = req.params
  const scope = (req.query.scope as string | undefined)?.toLowerCase()
  const message = await Message.findById(messageId)
  if (!message) throw new ApiError(404, 'Message not found')
  await assertParticipant(String(message.conversationId), userId)

  const isSender = String(message.sender) === userId
  const deleteForEveryone = scope === 'everyone' ? true : scope === 'me' ? false : isSender

  if (deleteForEveryone && !isSender) {
    throw new ApiError(403, 'Only sender can delete for everyone')
  }

  if (deleteForEveryone) {
    message.isDeleted = true
    message.content = ''
    message.fileUrl = undefined
    message.fileName = undefined
    message.fileSize = undefined
    message.mimeType = undefined
    message.thumbnailUrl = undefined
    message.reactions = []
    await message.save()
  } else {
    const uid = new mongoose.Types.ObjectId(userId)
    if (!message.deletedFor.some((u) => u.equals(uid))) {
      message.deletedFor.push(uid)
      await message.save()
    }
  }

  const io = getIO()
  if (io) {
    const conversationId = String(message.conversationId)
    const forEveryone = deleteForEveryone
    if (forEveryone) {
      io.to(conversationId).emit('message_deleted', {
        conversationId,
        messageId: String(message._id),
        forEveryone: true,
      })
    } else {
      io.to(`user:${userId}`).emit('message_deleted', {
        conversationId,
        messageId: String(message._id),
        forEveryone: false,
      })
    }
  }

  return sendSuccess(res, { messageId }, 'Message deleted')
})

export const reactToMessage = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const { messageId } = req.params
  const { emoji } = req.body as { emoji: string }

  const message = await Message.findById(messageId)
  if (!message) throw new ApiError(404, 'Message not found')
  await assertParticipant(String(message.conversationId), userId)
  if (message.isDeleted) throw new ApiError(400, 'Cannot react to deleted message')

  const uid = new mongoose.Types.ObjectId(userId)
  const idx = message.reactions.findIndex((r) => r.user.equals(uid))

  if (idx === -1) {
    message.reactions.push({ user: uid, emoji, createdAt: new Date() })
  } else if (message.reactions[idx].emoji === emoji) {
    message.reactions.splice(idx, 1)
  } else {
    message.reactions[idx].emoji = emoji
    message.reactions[idx].createdAt = new Date()
  }

  await message.save()
  const populated = await message.populate(MESSAGE_POPULATE)

  const io = getIO()
  if (io) {
    io.to(String(message.conversationId)).emit('message_updated', {
      conversationId: String(message.conversationId),
      message: populated.toJSON(),
    })
  }

  return sendSuccess(res, populated.toJSON(), 'Reaction updated')
})
