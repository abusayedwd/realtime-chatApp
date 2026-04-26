import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { VerifyEmailForm } from '@/components/auth/VerifyEmailForm'

interface PageProps {
  searchParams: { email?: string; pw?: string }
}

export default function VerifyEmailPage({ searchParams }: PageProps) {
  const email = searchParams?.email
  if (!email) redirect('/register')

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-ink">Check your email</h1>
        <p className="mt-1 text-sm text-ink-muted">Enter the 6-digit code we sent you</p>
      </div>
      <Suspense>
        <VerifyEmailForm email={email} password={searchParams?.pw} />
      </Suspense>
    </div>
  )
}
