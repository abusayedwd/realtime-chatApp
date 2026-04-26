'use client'

import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch'
import { setCredentials, logoutAction, setHydrated } from '@/store/slices/authSlice'
import { useRefreshMutation } from '@/store/api/authApi'
import { useSocket } from '@/hooks/useSocket'

/**
 * On first mount, try to silently refresh the access token using the
 * HTTP-only refresh cookie. Once that's settled, mark auth as `hydrated`.
 *
 * Also mounts the socket listeners once the user is authenticated.
 */
export const SessionBootstrap = ({ children }: { children: React.ReactNode }) => {
  const dispatch = useAppDispatch()
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated)
  const hydrated = useAppSelector((s) => s.auth.hydrated)
  const [refresh] = useRefreshMutation()

  useSocket()

  useEffect(() => {
    if (hydrated) return
    ;(async () => {
      try {
        const res = await refresh().unwrap()
        dispatch(setCredentials({ accessToken: res.accessToken, user: res.user }))
      } catch {
        dispatch(logoutAction())
      } finally {
        dispatch(setHydrated())
      }
    })()
  }, [refresh, dispatch, hydrated])

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-ink-muted">
          <svg className="h-5 w-5 animate-spin text-brand" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Loading your session...
        </div>
      </div>
    )
  }

  return <>{children}</>
}
