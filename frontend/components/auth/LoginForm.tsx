'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, LoginValues } from '@/validations/authSchema'
import { useLoginMutation } from '@/store/api/authApi'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { setCredentials } from '@/store/slices/authSlice'
import { pushToast, toast } from '@/store/slices/uiSlice'

export const LoginForm = () => {
  const router = useRouter()
  const params = useSearchParams()
  const dispatch = useAppDispatch()
  const [login, { isLoading }] = useLoginMutation()

  const prefillEmail = params.get('email') ?? ''

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: { email: prefillEmail },
  })

  const onSubmit = async (values: LoginValues) => {
    try {
      const res = await login(values).unwrap()
      dispatch(setCredentials({ accessToken: res.accessToken, user: res.user }))
      dispatch(pushToast(toast.success(`Welcome back, ${res.user.name}!`)))
      const from = params.get('from')
      router.replace(from || '/')
    } catch (err) {
      const status = (err as { status?: number }).status
      const msg = (err as { message?: string })?.message ?? 'Login failed'
      if (status === 403) {
        dispatch(pushToast(toast.info('Please verify your email first')))
        router.push(`/verify-email?email=${encodeURIComponent(values.email)}`)
      } else {
        dispatch(pushToast(toast.error(msg)))
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input
        label="Email"
        type="email"
        placeholder="ada@lovelace.dev"
        autoComplete="email"
        {...register('email')}
        error={errors.email?.message}
      />
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-ink">Password</label>
          <Link href="/forgot-password" className="text-xs text-brand hover:text-brand-light">
            Forgot password?
          </Link>
        </div>
        <Input
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          {...register('password')}
          error={errors.password?.message}
        />
      </div>

      <Button type="submit" fullWidth size="lg" isLoading={isLoading}>
        Sign in
      </Button>

      <p className="mt-2 text-center text-sm text-ink-muted">
        No account yet?{' '}
        <Link href="/register" className="font-medium text-brand hover:text-brand-light">
          Create one
        </Link>
      </p>
    </form>
  )
}
