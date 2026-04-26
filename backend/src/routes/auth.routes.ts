import { Router } from 'express'
import {
  register,
  verifyEmail,
  login,
  refresh,
  logout,
  resendOtpCtrl,
} from '../controllers/auth.controller'
import { validate } from '../middlewares/validate.middleware'
import { authenticate } from '../middlewares/auth.middleware'
import { authLimiter, otpLimiter } from '../middlewares/rateLimiter.middleware'
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendOtpSchema,
} from '../validations/auth.schema'

const router = Router()

router.post('/register', authLimiter, validate(registerSchema), register)
router.post('/verify-email', otpLimiter, validate(verifyEmailSchema), verifyEmail)
router.post('/login', authLimiter, validate(loginSchema), login)
router.post('/refresh', refresh)
router.post('/logout', authenticate, logout)
router.post('/resend-otp', otpLimiter, validate(resendOtpSchema), resendOtpCtrl)

export default router
