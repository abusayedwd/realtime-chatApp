import { Request, Response } from 'express'
import mongoose from 'mongoose'
import { asyncHandler } from '../utils/asyncHandler'
import { sendSuccess, sendCreated } from '../utils/ApiResponse'
import { ApiError } from '../utils/ApiError'
import { Conversation } from '../models/Conversation.model'
import { Message } from '../models/Message.model'
import { uploadBufferToCloudinary } from '../services/file.service'
import { getIO } from '../socket/socket'

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
    isDeleted: false,
    deletedFor: { $nin: [new mongoose.Types.ObjectId(userId)] },
  }

  const [items, total] = await Promise.all([
    Message.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('sender', 'name email avatar')
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
  const { type, content, fileUrl, fileName, fileSize, mimeType, thumbnailUrl } = req.body

  if (type === 'text' && !content?.trim()) {
    throw new ApiError(400, 'Message content cannot be empty')
  }
  if (type !== 'text' && !fileUrl) {
    throw new ApiError(400, 'File URL is required for non-text messages')
  }

  await assertParticipant(conversationId, userId)

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

  const io = getIO()
  if (io) io.to(conversationId).emit('new_message', { message: populated.toJSON() })

  return sendCreated(res, populated.toJSON(), 'Message sent')
})

export const uploadAndSend = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const { conversationId } = req.params

  if (!req.file) throw new ApiError(400, 'No file provided')
  await assertParticipant(conversationId, userId)

  const uploaded = await uploadBufferToCloudinary(req.file.buffer, req.file)

  const type: 'image' | 'video' | 'file' = uploaded.mimeType.startsWith('image/')
    ? 'image'
    : uploaded.mimeType.startsWith('video/')
      ? 'video'
      : 'file'

  const message = await Message.create({
    conversationId,
    sender: userId,
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

  const populated = await message.populate('sender', 'name email avatar')

  const io = getIO()
  if (io) io.to(conversationId).emit('new_message', { message: populated.toJSON() })

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

  return sendSuccess(res, { messageIds }, 'Messages marked as read')
})

export const deleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const { messageId } = req.params
  const message = await Message.findById(messageId)
  if (!message) throw new ApiError(404, 'Message not found')

  if (String(message.sender) === userId) {
    message.isDeleted = true
    message.content = ''
    message.fileUrl = undefined
    message.thumbnailUrl = undefined
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
    io.to(String(message.conversationId)).emit('message_deleted', {
      conversationId: String(message.conversationId),
      messageId: String(message._id),
      forEveryone: String(message.sender) === userId,
    })
  }

  return sendSuccess(res, { messageId }, 'Message deleted')
})
