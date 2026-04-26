import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-ink">Create your account</h1>
        <p className="mt-1 text-sm text-ink-muted">Start chatting in under a minute</p>
      </div>
      <RegisterForm />
    </div>
  )
}
