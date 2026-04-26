import { transporter } from '../config/mailer'
import { env } from '../config/env'
import { logger } from '../utils/logger'

const baseHtml = (title: string, body: string) => /* html */ `
<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#0f0f1a; padding:24px; margin:0;">
    <div style="max-width:600px; margin:0 auto; background:#1a1a2e; border-radius:12px; overflow:hidden; border:1px solid #2a2a44;">
      <div style="padding:32px; text-align:center;">
        <div style="display:inline-block; padding:10px 18px; border-radius:999px; background:#e94560; color:#fff; font-weight:700; letter-spacing:1px;">
          ChatApp
        </div>
        <h1 style="color:#fff; font-size:24px; margin:24px 0 8px;">${title}</h1>
        ${body}
      </div>
      <div style="padding:16px 32px; background:#13131f; color:#6b7280; font-size:12px; text-align:center;">
        If you didn't request this, you can safely ignore this email.
      </div>
    </div>
  </body>
</html>`

export const sendVerificationEmail = async (email: string, name: string, code: string) => {
  const html = baseHtml(
    'Verify Your Email',
    `
    <p style="color:#9ca3af; font-size:15px;">Hi <strong style="color:#fff;">${name}</strong>, enter this verification code to activate your account:</p>
    <div style="margin:24px auto; padding:20px; background:#16213e; border-radius:10px; display:inline-block;">
      <span style="font-size:36px; font-weight:800; letter-spacing:10px; color:#e94560;">${code}</span>
    </div>
    <p style="color:#9ca3af; font-size:13px;">This code expires in <strong style="color:#fff;">15 minutes</strong>.</p>
    `
  )

  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: email,
      subject: 'Verify your ChatApp account',
      html,
    })
    logger.info(`Verification email sent → ${email}`)
  } catch (err) {
    logger.error('Failed to send verification email:', (err as Error).message)
    throw err
  }
}

export const sendPasswordResetEmail = async (email: string, name: string, resetUrl: string) => {
  const html = baseHtml(
    'Reset Your Password',
    `
    <p style="color:#9ca3af; font-size:15px;">Hi <strong style="color:#fff;">${name}</strong>, we received a request to reset your password.</p>
    <div style="margin:28px auto;">
      <a href="${resetUrl}"
         style="display:inline-block; padding:14px 32px; background:#e94560; color:#fff; font-weight:700; font-size:15px; border-radius:10px; text-decoration:none; letter-spacing:0.5px;">
        Reset Password
      </a>
    </div>
    <p style="color:#9ca3af; font-size:13px;">This link expires in <strong style="color:#fff;">15 minutes</strong>.</p>
    <p style="color:#6b7280; font-size:12px; margin-top:16px;">Or copy this link:<br/><span style="color:#9ca3af;">${resetUrl}</span></p>
    `
  )

  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: email,
      subject: 'Reset your ChatApp password',
      html,
    })
    logger.info(`Password reset email sent → ${email}`)
  } catch (err) {
    logger.error('Failed to send password reset email:', (err as Error).message)
    throw err
  }
}
