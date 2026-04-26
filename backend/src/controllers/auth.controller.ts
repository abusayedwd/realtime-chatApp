import { Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import { sendCreated, sendSuccess } from '../utils/ApiResponse'
import { ApiError } from '../utils/ApiError'
import { env } from '../config/env'
import {
  registerUser,
  verifyEmailCode,
  loginUser,
  refreshSession,
  logoutUser,
  resendOtp,
  forgotPassword,
  resetPassword,
  changePassword,
} from '../services/auth.service'

const REFRESH_COOKIE_NAME = 'refreshToken'
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000

const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: REFRESH_TTL_MS,
    path: '/',
  })
}

const clearRefreshCookie = (res: Response) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  })
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password } = req.body
  await registerUser({ name, email, password })
  return sendCreated(
    res,
    { email },
    'Verification code sent to your email. Please verify to complete registration.'
  )
})

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { email, code } = req.body
  await verifyEmailCode(email, code)
  return sendSuccess(res, { email }, 'Email verified successfully. You can now log in.')
})

export const resendOtpCtrl = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body
  await resendOtp(email)
  return sendSuccess(res, { email }, 'A new verification code has been sent')
})

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body
  const { accessToken, refreshToken, user } = await loginUser(email, password)
  setRefreshCookie(res, refreshToken)
  return sendSuccess(res, { accessToken, user }, 'Login successful')
})

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME]
  if (!token) throw new ApiError(401, 'No refresh token provided')
  const { accessToken, refreshToken, user } = await refreshSession(token)
  setRefreshCookie(res, refreshToken)
  return sendSuccess(res, { accessToken, user }, 'Token refreshed')
})

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.userId) await logoutUser(req.user.userId)
  clearRefreshCookie(res)
  return sendSuccess(res, null, 'Logged out successfully')
})

export const forgotPasswordCtrl = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body
  await forgotPassword(email)
  // Always return success to prevent email enumeration
  return sendSuccess(res, null, 'If an account exists for that email, a reset link has been sent.')
})

export const resetPasswordCtrl = asyncHandler(async (req: Request, res: Response) => {
  const { email, token, password } = req.body
  await resetPassword(email, token, password)
  return sendSuccess(res, null, 'Password reset successfully. You can now log in.')
})

export const changePasswordCtrl = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body
  await changePassword(req.user!.userId, currentPassword, newPassword)
  return sendSuccess(res, null, 'Password changed successfully.')
})
