import crypto from 'crypto'
import jwt, { SignOptions } from 'jsonwebtoken'
import { env } from '../config/env'
import { RefreshToken } from '../models/RefreshToken.model'

const REFRESH_TTL_DAYS = 7

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')

export interface AccessPayload {
  userId: string
  email: string
}

export const signAccessToken = (payload: AccessPayload) =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES as SignOptions['expiresIn'],
  })

export const signRefreshToken = (userId: string) =>
  jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES as SignOptions['expiresIn'],
  })

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload & jwt.JwtPayload

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, env.JWT_REFRESH_SECRET) as { userId: string } & jwt.JwtPayload

export const storeRefreshToken = async (userId: string, token: string) => {
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000)
  // Replace any existing token for this user (single active session)
  await RefreshToken.findOneAndUpdate(
    { userId },
    { userId, hash: hashToken(token), expiresAt },
    { upsert: true, new: true }
  )
}

export const isRefreshTokenValid = async (userId: string, token: string): Promise<boolean> => {
  const doc = await RefreshToken.findOne({ userId, hash: hashToken(token) })
  if (!doc) return false
  if (doc.expiresAt < new Date()) {
    await doc.deleteOne()
    return false
  }
  return true
}

export const revokeRefreshToken = async (userId: string) => {
  await RefreshToken.deleteOne({ userId })
}

export const generateOtpCode = (): string => {
  return crypto.randomInt(100_000, 1_000_000).toString()
}
