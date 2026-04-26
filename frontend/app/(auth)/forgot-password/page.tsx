import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export default function ForgotPasswordPage() {
  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-ink">Forgot password?</h1>
        <p className="mt-1 text-sm text-ink-muted">No worries, we'll send you a reset link</p>
      </div>
      <ForgotPasswordForm />
    </div>
  )
}
