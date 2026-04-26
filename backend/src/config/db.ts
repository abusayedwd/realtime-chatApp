import mongoose from 'mongoose'
import { env } from './env'
import { logger } from '../utils/logger'

mongoose.set('strictQuery', true)

const MAX_RETRIES = 5
const RETRY_DELAY_MS = 3000

export const connectDB = async (): Promise<void> => {
  let attempt = 0
  while (attempt < MAX_RETRIES) {
    try {
      await mongoose.connect(env.MONGODB_URI, {
        autoIndex: env.NODE_ENV !== 'production',
        serverSelectionTimeoutMS: 10000,
      })
      logger.info(`MongoDB connected → ${mongoose.connection.host}/${mongoose.connection.name}`)
      return
    } catch (err) {
      attempt += 1
      const msg = (err as Error).message ?? String(err)
      logger.error(`MongoDB connection failed (attempt ${attempt}/${MAX_RETRIES}): ${msg}`)
      logger.error('  → Make sure MongoDB is running (Docker: docker-compose up -d)')
      if (attempt >= MAX_RETRIES) throw err
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    }
  }
}

mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'))
mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'))
mongoose.connection.on('error', (err) => logger.error('MongoDB error:', err))
