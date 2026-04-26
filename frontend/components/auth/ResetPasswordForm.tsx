'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { resetPasswordSchema, ResetPasswordValues } from '@/validations/authSchema'
import { useResetPasswordMutation } from '@/store/api/authApi'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface Props {
  email: string
  token: string
}

export const ResetPasswordForm = ({ email, token }: Props) => {
  const router = useRouter()
  const [done, setDone] = useState(false)
  const [resetPassword, { isLoading }] = useResetPasswordMutation()

  const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const onSubmit = async (values: ResetPasswordValues) => {
    try {
      await resetPassword({ email, token, ...values }).unwrap()
      setDone(true)
      setTimeout(() => router.replace('/login'), 2500)
    } catch (err) {
      // error shown via toast in future; for now re-throw so form shows inline error
      throw err
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-ink">Password reset!</p>
          <p className="mt-1 text-sm text-ink-muted">Redirecting you to sign in…</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        Resetting password for <span className="font-medium text-ink">{email}</span>
      </p>

      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        {...register('password')}
        error={errors.password?.message}
        hint="Min 8 chars · uppercase · lowercase · number"
      />
      <Input
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        {...register('confirmPassword')}
        error={errors.confirmPassword?.message}
      />

      <Button type="submit" fullWidth size="lg" isLoading={isLoading}>
        Set new password
      </Button>

      <p className="text-center text-sm text-ink-muted">
        <Link href="/forgot-password" className="font-medium text-brand hover:text-brand-light">
          Request a new link
        </Link>
      </p>
    </form>
  )
}
