import crypto from 'crypto'
import { User, IUser } from '../models/User.model'
import { ApiError } from '../utils/ApiError'
import { env } from '../config/env'
import {
  generateOtpCode,
  signAccessToken,
  signRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  isRefreshTokenValid,
  revokeRefreshToken,
} from './token.service'
import { sendVerificationEmail, sendPasswordResetEmail } from './email.service'

const OTP_TTL_MINUTES = 15
const OTP_MAX_ATTEMPTS = 5
const OTP_LOCK_MINUTES = 30
const RESEND_COOLDOWN_SECONDS = 60
const RESET_TTL_MINUTES = 15

export interface SafeUser {
  id: string
  name: string
  email: string
  avatar?: string
  isVerified: boolean
  isOnline: boolean
  lastSeen: Date
  createdAt: Date
}

export const toSafeUser = (u: IUser): SafeUser => ({
  id: u._id.toString(),
  name: u.name,
  email: u.email,
  avatar: u.avatar,
  isVerified: u.isVerified,
  isOnline: u.isOnline,
  lastSeen: u.lastSeen,
  createdAt: u.createdAt,
})

export const registerUser = async (input: {
  name: string
  email: string
  password: string
}) => {
  const existing = await User.findOne({ email: input.email }).select(
    '+emailVerificationCode +emailVerificationExpires +lastOtpSentAt'
  )

  if (existing && existing.isVerified) {
    throw new ApiError(409, 'An account with this email already exists')
  }

  const code = generateOtpCode()
  const expires = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)

  let user: IUser
  if (existing && !existing.isVerified) {
    existing.name = input.name
    existing.password = input.password
    existing.emailVerificationCode = code
    existing.emailVerificationExpires = expires
    existing.otpAttempts = 0
    existing.otpLockedUntil = undefined
    existing.lastOtpSentAt = new Date()
    user = await existing.save()
  } else {
    user = await User.create({
      name: input.name,
      email: input.email,
      password: input.password,
      emailVerificationCode: code,
      emailVerificationExpires: expires,
      lastOtpSentAt: new Date(),
    })
  }

  await sendVerificationEmail(user.email, user.name, code)
}

export const resendOtp = async (email: string) => {
  const user = await User.findOne({ email }).select(
    '+emailVerificationCode +emailVerificationExpires +otpAttempts +otpLockedUntil +lastOtpSentAt'
  )
  if (!user) throw new ApiError(404, 'Account not found')
  if (user.isVerified) throw new ApiError(400, 'Account is already verified')

  if (user.lastOtpSentAt) {
    const elapsed = (Date.now() - user.lastOtpSentAt.getTime()) / 1000
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      throw new ApiError(
        429,
        `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed)}s before requesting a new code`
      )
    }
  }

  const code = generateOtpCode()
  user.emailVerificationCode = code
  user.emailVerificationExpires = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)
  user.otpAttempts = 0
  user.otpLockedUntil = undefined
  user.lastOtpSentAt = new Date()
  await user.save()

  await sendVerificationEmail(user.email, user.name, code)
}

export const verifyEmailCode = async (email: string, code: string) => {
  const user = await User.findOne({ email }).select(
    '+emailVerificationCode +emailVerificationExpires +otpAttempts +otpLockedUntil'
  )

  if (!user) throw new ApiError(404, 'Account not found')
  if (user.isVerified) throw new ApiError(400, 'Account is already verified')

  if (user.otpLockedUntil && user.otpLockedUntil > new Date()) {
    const mins = Math.ceil((user.otpLockedUntil.getTime() - Date.now()) / 60_000)
    throw new ApiError(429, `Too many failed attempts. Try again in ${mins} minute(s).`)
  }

  if (!user.emailVerificationCode || !user.emailVerificationExpires) {
    throw new ApiError(400, 'No verification code pending — please request a new one')
  }

  if (user.emailVerificationExpires.getTime() < Date.now()) {
    throw new ApiError(400, 'Verification code expired — please request a new one')
  }

  if (user.emailVerificationCode !== code) {
    user.otpAttempts = (user.otpAttempts ?? 0) + 1
    if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
      user.otpLockedUntil = new Date(Date.now() + OTP_LOCK_MINUTES * 60 * 1000)
      await user.save()
      throw new ApiError(429, `Too many failed attempts. Locked for ${OTP_LOCK_MINUTES} minutes.`)
    }
    await user.save()
    throw new ApiError(400, `Invalid code. ${OTP_MAX_ATTEMPTS - user.otpAttempts} attempts remaining`)
  }

  user.isVerified = true
  user.emailVerificationCode = undefined
  user.emailVerificationExpires = undefined
  user.otpAttempts = 0
  user.otpLockedUntil = undefined
  await user.save()
}

export const loginUser = async (email: string, password: string) => {
  const user = await User.findOne({ email }).select('+password')
  if (!user) throw new ApiError(401, 'Invalid credentials')
  if (!user.isVerified) throw new ApiError(403, 'Please verify your email first')

  const ok = await user.comparePassword(password)
  if (!ok) throw new ApiError(401, 'Invalid credentials')

  const accessToken = signAccessToken({ userId: user._id.toString(), email: user.email })
  const refreshToken = signRefreshToken(user._id.toString())
  await storeRefreshToken(user._id.toString(), refreshToken)

  return { accessToken, refreshToken, user: toSafeUser(user) }
}

export const refreshSession = async (refreshToken: string) => {
  const decoded = verifyRefreshToken(refreshToken)
  const valid = await isRefreshTokenValid(decoded.userId, refreshToken)
  if (!valid) throw new ApiError(401, 'Refresh token revoked or invalid')

  const user = await User.findById(decoded.userId)
  if (!user) throw new ApiError(401, 'User no longer exists')

  const newRefresh = signRefreshToken(user._id.toString())
  await storeRefreshToken(user._id.toString(), newRefresh)

  const accessToken = signAccessToken({ userId: user._id.toString(), email: user.email })
  return { accessToken, refreshToken: newRefresh, user: toSafeUser(user) }
}

export const logoutUser = async (userId: string) => {
  await revokeRefreshToken(userId)
}

// ── Forgot password ────────────────────────────────────────────────────────────
export const forgotPassword = async (email: string) => {
  const user = await User.findOne({ email })
  // Always respond with success to avoid email enumeration
  if (!user || !user.isVerified) return

  const rawToken = crypto.randomBytes(32).toString('hex')
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')

  user.passwordResetToken = hashedToken
  user.passwordResetExpires = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000)
  await user.save()

  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`
  await sendPasswordResetEmail(email, user.name, resetUrl)
}

// ── Reset password (via email link) ───────────────────────────────────────────
export const resetPassword = async (email: string, token: string, newPassword: string) => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

  const user = await User.findOne({ email }).select('+passwordResetToken +passwordResetExpires +password')
  if (!user) throw new ApiError(400, 'Invalid or expired reset link')

  if (
    !user.passwordResetToken ||
    !user.passwordResetExpires ||
    user.passwordResetToken !== hashedToken ||
    user.passwordResetExpires < new Date()
  ) {
    throw new ApiError(400, 'Invalid or expired reset link. Please request a new one.')
  }

  user.password = newPassword
  user.passwordResetToken = undefined
  user.passwordResetExpires = undefined
  await user.save()
}

// ── Change password (logged-in user) ──────────────────────────────────────────
export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
) => {
  const user = await User.findById(userId).select('+password')
  if (!user) throw new ApiError(404, 'User not found')

  const ok = await user.comparePassword(currentPassword)
  if (!ok) throw new ApiError(400, 'Current password is incorrect')

  if (currentPassword === newPassword) {
    throw new ApiError(400, 'New password must be different from current password')
  }

  user.password = newPassword
  await user.save()
}
