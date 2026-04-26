import path from 'path'
import fs from 'fs'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import compression from 'compression'
import mongoSanitize from 'express-mongo-sanitize'

import { env } from './config/env'
import { apiLimiter } from './middlewares/rateLimiter.middleware'
import { notFound, errorHandler } from './middlewares/error.middleware'
import routes from './routes'

const app = express()

app.set('trust proxy', 1)

app.use(helmet())
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true)
      // In development allow every origin
      if (env.NODE_ENV === 'development') return callback(null, true)
      // In production only allow the configured CLIENT_URL
      if (origin === env.CLIENT_URL) return callback(null, true)
      callback(new Error(`CORS: origin ${origin} not allowed`))
    },
    credentials: true,
  })
)
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
app.use(cookieParser())
app.use(compression())
app.use(mongoSanitize())

// Serve locally uploaded files (dev fallback when Cloudinary is not configured)
const uploadsDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
app.use('/uploads', express.static(uploadsDir))

app.use('/api', apiLimiter, routes)

app.use(notFound)
app.use(errorHandler)

export default app
