'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppSelector } from '@/hooks/useAppDispatch'

/** Sends already-authenticated users away from /login, /register, etc. */
export const AuthRedirectIfLoggedIn = () => {
  const router = useRouter()
  const hydrated = useAppSelector((s) => s.auth.hydrated)
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated)

  useEffect(() => {
    if (hydrated && isAuthenticated) router.replace('/')
  }, [hydrated, isAuthenticated, router])

  return null
}
