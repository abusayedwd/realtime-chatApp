import rateLimit from 'express-rate-limit'

// All limiters use the built-in MemoryStore — no Redis required.
// For multi-process deployments swap MemoryStore with a shared store.

const isDev = process.env.NODE_ENV === 'development'

export const authLimiter = rateLimit({
  // Keep strict limits in production; stay lenient in local development.
  windowMs: isDev ? 60 * 1000 : 15 * 60 * 1000,
  max: isDev ? 200 : 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
})

export const otpLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OTP attempts. Please try again later.' },
})

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
})
