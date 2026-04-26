import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

interface PageProps {
  searchParams: { token?: string; email?: string }
}

export default function ResetPasswordPage({ searchParams }: PageProps) {
  const { token, email } = searchParams
  if (!token || !email) redirect('/forgot-password')

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-ink">Set new password</h1>
        <p className="mt-1 text-sm text-ink-muted">Choose a strong password</p>
      </div>
      <Suspense>
        <ResetPasswordForm email={email} token={token} />
      </Suspense>
    </div>
  )
}
