import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
        <p className="mt-1 text-sm text-ink-muted">Sign in to continue to your conversations</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
