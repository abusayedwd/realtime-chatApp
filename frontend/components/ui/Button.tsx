import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  isLoading?: boolean
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
}

const variants: Record<Variant, string> = {
  primary:
    'bg-brand text-white hover:bg-brand-dark focus:ring-brand disabled:bg-brand/50',
  secondary:
    'bg-bg-hover text-ink hover:bg-bg-elevated border border-line',
  ghost:
    'text-ink-muted hover:bg-bg-hover hover:text-ink',
  danger:
    'bg-red-600 text-white hover:bg-red-700',
}

const sizes = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, fullWidth, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium outline-none transition focus:ring-2 focus:ring-offset-1 focus:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-70',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {isLoading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  )
)
Button.displayName = 'Button'
