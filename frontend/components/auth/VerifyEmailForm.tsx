'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { OtpInput } from './OtpInput'
import { Button } from '@/components/ui/Button'
import { useVerifyEmailMutation, useResendOtpMutation, useLoginMutation } from '@/store/api/authApi'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { pushToast, toast } from '@/store/slices/uiSlice'
import { setCredentials } from '@/store/slices/authSlice'

const RESEND_COOLDOWN = 60

export const VerifyEmailForm = ({ email, password }: { email: string; password?: string }) => {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const [verify, { isLoading: isVerifying }] = useVerifyEmailMutation()
  const [loginUser, { isLoading: isLoggingIn }] = useLoginMutation()
  const [resend, { isLoading: isResending }] = useResendOtpMutation()

  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (code.length !== 6) {
      setError('Please enter all 6 digits')
      return
    }
    try {
      await verify({ email, code }).unwrap()
      setVerified(true)
      dispatch(pushToast(toast.success('Email verified successfully!')))

      // If password was passed (came from register), auto-login
      if (password) {
        try {
          const res = await loginUser({ email, password }).unwrap()
          dispatch(setCredentials({ accessToken: res.accessToken, user: res.user }))
          dispatch(pushToast(toast.success(`Welcome, ${res.user.name}! 🎉`)))
          router.replace('/')
        } catch {
          // Auto-login failed — redirect to login page manually
          router.replace(`/login?email=${encodeURIComponent(email)}`)
        }
      } else {
        router.replace(`/login?email=${encodeURIComponent(email)}`)
      }
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'Verification failed'
      setError(msg)
      dispatch(pushToast(toast.error(msg)))
    }
  }

  const onResend = async () => {
    try {
      await resend({ email }).unwrap()
      dispatch(pushToast(toast.success('A new code has been sent to your email')))
      setCooldown(RESEND_COOLDOWN)
      setCode('')
      setError(null)
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'Could not resend code'
      dispatch(pushToast(toast.error(msg)))
    }
  }

  const isLoading = isVerifying || isLoggingIn

  return (
    <form onSubmit={onSubmit} className="flex flex-col items-center gap-5">
      {/* Email display */}
      <div className="w-full rounded-lg border border-line bg-bg-input px-4 py-3 text-center">
        <p className="text-xs text-ink-dim mb-0.5">Verification code sent to</p>
        <p className="text-sm font-semibold text-brand break-all">{email}</p>
      </div>

      {/* OTP boxes */}
      <div className="w-full">
        <OtpInput value={code} onChange={setCode} error={Boolean(error)} disabled={isLoading || verified} />
      </div>

      {/* Error */}
      {error && (
        <div className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-center text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Submit */}
      <Button type="submit" fullWidth size="lg" isLoading={isLoading} disabled={verified}>
        {verified ? 'Verified ✓' : 'Verify email'}
      </Button>

      {/* Resend */}
      <div className="flex w-full flex-col items-center gap-2 text-center">
        <button
          type="button"
          onClick={onResend}
          disabled={cooldown > 0 || isResending || isLoading || verified}
          className="text-sm text-ink-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isResending
            ? 'Sending...'
            : cooldown > 0
              ? `Resend code in ${cooldown}s`
              : 'Resend code'}
        </button>

        <a
          href={`/register`}
          className="text-xs text-ink-dim hover:text-ink transition"
        >
          ← Wrong email? Go back
        </a>
      </div>
    </form>
  )
}
