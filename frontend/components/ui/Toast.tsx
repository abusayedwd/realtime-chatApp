'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch'
import { dismissToast } from '@/store/slices/uiSlice'

export const ToastViewport = () => {
  const toasts = useAppSelector((s) => s.ui.toasts)
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (toasts.length === 0) return
    const timers = toasts.map((t) => setTimeout(() => dispatch(dismissToast(t.id)), 3500))
    return () => timers.forEach(clearTimeout)
  }, [toasts, dispatch])

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dispatch(dismissToast(t.id))}
          className={cn(
            'pointer-events-auto animate-pop-in cursor-pointer rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur',
            t.type === 'success' && 'border-emerald-600/40 bg-emerald-900/60 text-emerald-100',
            t.type === 'error' && 'border-red-600/40 bg-red-900/60 text-red-100',
            t.type === 'info' && 'border-sky-600/40 bg-sky-900/60 text-sky-100'
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
