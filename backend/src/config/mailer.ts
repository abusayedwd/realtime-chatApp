import nodemailer from 'nodemailer'
import { env } from './env'
import { logger } from '../utils/logger'

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
})

export const verifyMailer = async () => {
  try {
    await transporter.verify()
    logger.info('SMTP server is ready to send emails')
  } catch (err) {
    logger.error('SMTP verification failed:', (err as Error).message)
  }
}
