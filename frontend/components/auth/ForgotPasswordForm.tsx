'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { forgotPasswordSchema, ForgotPasswordValues } from '@/validations/authSchema'
import { useForgotPasswordMutation } from '@/store/api/authApi'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export const ForgotPasswordForm = () => {
  const [sent, setSent] = useState(false)
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation()

  const { register, handleSubmit, formState: { errors }, getValues } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (values: ForgotPasswordValues) => {
    try {
      await forgotPassword(values).unwrap()
      setSent(true)
    } catch {
      // show success anyway (anti-enumeration)
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/20 text-brand">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-ink">Check your email</p>
          <p className="mt-1 text-sm text-ink-muted">
            If <span className="font-medium text-ink">{getValues('email')}</span> has an account,
            we've sent a password reset link.
          </p>
          <p className="mt-2 text-xs text-ink-dim">The link expires in 15 minutes.</p>
        </div>
        <Link href="/login" className="text-sm font-medium text-brand hover:text-brand-light">
          ← Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        Enter your email and we'll send you a link to reset your password.
      </p>
      <Input
        label="Email"
        type="email"
        placeholder="ada@lovelace.dev"
        autoComplete="email"
        autoFocus
        {...register('email')}
        error={errors.email?.message}
      />
      <Button type="submit" fullWidth size="lg" isLoading={isLoading}>
        Send reset link
      </Button>
      <p className="text-center text-sm text-ink-muted">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-brand hover:text-brand-light">
          Sign in
        </Link>
      </p>
    </form>
  )
}
