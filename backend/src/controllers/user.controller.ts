import { Request, Response } from 'express'
import mongoose from 'mongoose'
import { asyncHandler } from '../utils/asyncHandler'
import { sendSuccess } from '../utils/ApiResponse'
import { ApiError } from '../utils/ApiError'
import { User } from '../models/User.model'
import { toSafeUser, toPublicUser } from '../services/auth.service'
import { uploadBufferToCloudinary } from '../services/file.service'

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.userId)
  if (!user) throw new ApiError(404, 'User not found')
  return sendSuccess(res, toSafeUser(user))
})

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const { name, avatar } = req.body as { name?: string; avatar?: string }
  const update: Record<string, unknown> = {}
  if (name !== undefined) update.name = name.trim()
  if (avatar !== undefined) update.avatar = avatar

  const user = await User.findByIdAndUpdate(req.user!.userId, update, { new: true })
  if (!user) throw new ApiError(404, 'User not found')
  return sendSuccess(res, toSafeUser(user), 'Profile updated')
})

export const uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new ApiError(400, 'No image provided')

  const uploaded = await uploadBufferToCloudinary(req.file.buffer, req.file)

  const user = await User.findByIdAndUpdate(
    req.user!.userId,
    { avatar: uploaded.url },
    { new: true }
  )
  if (!user) throw new ApiError(404, 'User not found')
  return sendSuccess(res, toSafeUser(user), 'Avatar updated')
})

export const searchUsers = asyncHandler(async (req: Request, res: Response) => {
  const q = String(req.query.q ?? '').trim()
  const limit = Number(req.query.limit ?? 10)
  if (!q) return sendSuccess(res, [])

  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')

  const users = await User.find({
    _id: { $ne: new mongoose.Types.ObjectId(req.user!.userId) },
    $or: [{ name: regex }, { email: regex }],
  })
    .limit(limit)
    .sort({ name: 1 })

  return sendSuccess(res, users.map(toPublicUser))
})

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id)
  if (!user) throw new ApiError(404, 'User not found')
  return sendSuccess(res, toPublicUser(user))
})

export const getBlockedUsers = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.userId).populate('blockedUsers', 'name email avatar')
  if (!user) throw new ApiError(404, 'User not found')
  return sendSuccess(res, user.blockedUsers)
})

export const blockUser = asyncHandler(async (req: Request, res: Response) => {
  const targetId = req.params.id
  if (targetId === req.user!.userId) throw new ApiError(400, 'Cannot block yourself')

  const target = await User.findById(targetId)
  if (!target) throw new ApiError(404, 'User not found')

  const user = await User.findByIdAndUpdate(
    req.user!.userId,
    { $addToSet: { blockedUsers: targetId } },
    { new: true }
  )
  if (!user) throw new ApiError(404, 'User not found')
  return sendSuccess(res, toSafeUser(user), 'User blocked')
})

export const unblockUser = asyncHandler(async (req: Request, res: Response) => {
  const targetId = req.params.id
  const user = await User.findByIdAndUpdate(
    req.user!.userId,
    { $pull: { blockedUsers: targetId } },
    { new: true }
  )
  if (!user) throw new ApiError(404, 'User not found')
  return sendSuccess(res, toSafeUser(user), 'User unblocked')
})
