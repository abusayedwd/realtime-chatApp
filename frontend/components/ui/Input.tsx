'use client'

import { InputHTMLAttributes, forwardRef, ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: ReactNode
  hint?: string
}

const EyeOpen = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
  </svg>
)

const EyeClosed = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M1 1l22 22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, hint, className, id, type, ...props }, ref) => {
    const inputId = id ?? props.name
    const isPassword = type === 'password'
    const [showPassword, setShowPassword] = useState(false)

    const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-muted">
              {icon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            {...props}
            className={cn(
              'h-11 w-full rounded-lg border border-line bg-bg-input px-3 text-sm text-ink placeholder:text-ink-dim outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/40',
              icon && 'pl-10',
              isPassword && 'pr-11',
              error && 'border-red-500/60 focus:ring-red-500/40',
              className
            )}
          />

          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-3 flex items-center text-ink-dim transition hover:text-ink focus:outline-none"
            >
              {showPassword ? <EyeClosed /> : <EyeOpen />}
            </button>
          )}
        </div>

        {error ? (
          <span className="text-xs text-red-400">{error}</span>
        ) : hint ? (
          <span className="text-xs text-ink-dim">{hint}</span>
        ) : null}
      </div>
    )
  }
)
Input.displayName = 'Input'
