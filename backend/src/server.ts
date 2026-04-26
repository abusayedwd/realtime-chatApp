import http from 'http'
import app from './app'
import { env } from './config/env'
import { connectDB } from './config/db'
import { verifyMailer } from './config/mailer'
import { initSocket } from './socket/socket'
import { logger } from './utils/logger'

const bootstrap = async () => {
  await connectDB()
  await verifyMailer()

  const httpServer = http.createServer(app)
  initSocket(httpServer)

  httpServer.listen(env.PORT, () => {
    logger.info(`🚀 Server listening on http://localhost:${env.PORT}`)
    logger.info(`   NODE_ENV=${env.NODE_ENV}  CLIENT=${env.CLIENT_URL}`)
  })

  const shutdown = async (signal: string) => {
    logger.warn(`Received ${signal}, shutting down gracefully...`)
    httpServer.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 10_000).unref()
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('unhandledRejection', (reason) => logger.error('UnhandledRejection:', reason))
  process.on('uncaughtException', (err) => logger.error('UncaughtException:', err))
}

bootstrap().catch((err) => {
  logger.error('Fatal startup error:', err)
  process.exit(1)
})
