import { Request, Response } from 'express'
import mongoose from 'mongoose'
import { asyncHandler } from '../utils/asyncHandler'
import { sendSuccess, sendCreated } from '../utils/ApiResponse'
import { ApiError } from '../utils/ApiError'
import { Conversation } from '../models/Conversation.model'
import { Message } from '../models/Message.model'
import { User } from '../models/User.model'
import { getIO } from '../socket/socket'

export const listConversations = asyncHandler(async (req: Request, res: Response) => {
  const userId = new mongoose.Types.ObjectId(req.user!.userId)

  const conversations = await Conversation.find({ participants: userId })
    .sort({ lastMessageAt: -1 })
    .populate('participants', 'name email avatar isOnline lastSeen')
    .populate({
      path: 'lastMessage',
      select: 'content type sender createdAt fileName',
    })
    .lean()

  const unreadCounts = await Message.aggregate([
    {
      $match: {
        conversationId: { $in: conversations.map((c) => c._id) },
        sender: { $ne: userId },
        'readBy.user': { $nin: [userId] },
        isDeleted: false,
      },
    },
    { $group: { _id: '$conversationId', count: { $sum: 1 } } },
  ])

  const unreadMap = new Map<string, number>(
    unreadCounts.map((u) => [String(u._id), u.count as number])
  )

  const data = conversations.map((c) => ({
    ...c,
    unreadCount: unreadMap.get(String(c._id)) ?? 0,
  }))

  return sendSuccess(res, data)
})

export const createOrGetDM = asyncHandler(async (req: Request, res: Response) => {
  const me = new mongoose.Types.ObjectId(req.user!.userId)
  const other = new mongoose.Types.ObjectId(req.body.participantId)

  if (me.equals(other)) throw new ApiError(400, 'Cannot start a conversation with yourself')

  const otherUser = await User.findById(other)
  if (!otherUser) throw new ApiError(404, 'User not found')

  let convo = await Conversation.findOne({
    isGroup: false,
    participants: { $all: [me, other], $size: 2 },
  })
    .populate('participants', 'name email avatar isOnline lastSeen')
    .populate({ path: 'lastMessage', select: 'content type sender createdAt fileName' })

  let created = false
  if (!convo) {
    convo = await Conversation.create({
      participants: [me, other],
      isGroup: false,
      lastMessageAt: new Date(),
    })
    convo = await convo.populate('participants', 'name email avatar isOnline lastSeen')
    created = true

    // Tell both users to join the new room in their socket instance
    const io = getIO()
    if (io) {
      io.to(`user:${me.toString()}`).socketsJoin(convo._id.toString())
      io.to(`user:${other.toString()}`).socketsJoin(convo._id.toString())
    }
  }

  const result = { ...convo.toObject(), unreadCount: 0 }
  return created ? sendCreated(res, result, 'Conversation created') : sendSuccess(res, result)
})

export const getConversation = asyncHandler(async (req: Request, res: Response) => {
  const me = new mongoose.Types.ObjectId(req.user!.userId)
  const convo = await Conversation.findOne({ _id: req.params.id, participants: me })
    .populate('participants', 'name email avatar isOnline lastSeen')
    .populate({ path: 'lastMessage', select: 'content type sender createdAt fileName' })

  if (!convo) throw new ApiError(404, 'Conversation not found')
  return sendSuccess(res, convo)
})

export const deleteConversation = asyncHandler(async (req: Request, res: Response) => {
  const me = new mongoose.Types.ObjectId(req.user!.userId)
  const convo = await Conversation.findOne({ _id: req.params.id, participants: me })
  if (!convo) throw new ApiError(404, 'Conversation not found')

  // Remove self from participants
  convo.participants = convo.participants.filter((p) => !p.equals(me))
  if (convo.participants.length === 0) {
    await Message.deleteMany({ conversationId: convo._id })
    await convo.deleteOne()
  } else {
    await convo.save()
  }

  return sendSuccess(res, null, 'Conversation removed')
})
