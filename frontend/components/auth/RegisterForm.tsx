'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerSchema, RegisterValues } from '@/validations/authSchema'
import { useRegisterMutation } from '@/store/api/authApi'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { pushToast, toast } from '@/store/slices/uiSlice'

export const RegisterForm = () => {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const [registerUser, { isLoading }] = useRegisterMutation()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), mode: 'onBlur' })

  const onSubmit = async (values: RegisterValues) => {
    try {
      await registerUser(values).unwrap()
      dispatch(pushToast(toast.success('Verification code sent! Check your email.')))
      // Pass email + password so verify page can auto-login after OTP
      router.push(
        `/verify-email?email=${encodeURIComponent(values.email)}&pw=${encodeURIComponent(values.password)}`
      )
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'Registration failed'
      dispatch(pushToast(toast.error(msg)))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input
        label="Full name"
        placeholder="Ada Lovelace"
        autoComplete="name"
        {...register('name')}
        error={errors.name?.message}
      />
      <Input
        label="Email"
        type="email"
        placeholder="ada@lovelace.dev"
        autoComplete="email"
        {...register('email')}
        error={errors.email?.message}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        {...register('password')}
        error={errors.password?.message}
        hint="Min 8 chars • uppercase • lowercase • number"
      />
      <Input
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        {...register('confirmPassword')}
        error={errors.confirmPassword?.message}
      />

      <Button type="submit" fullWidth size="lg" isLoading={isLoading}>
        Create account
      </Button>

      <p className="mt-2 text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand hover:text-brand-light">
          Sign in
        </Link>
      </p>
    </form>
  )
}
