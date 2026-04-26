'use client'

import { cn, initials } from '@/lib/utils'

interface AvatarProps {
  src?: string | null
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  online?: boolean
  className?: string
}

const sizes = {
  xs: 'h-7 w-7 text-xs',
  sm: 'h-9 w-9 text-sm',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
}

const dotSizes = {
  xs: 'h-2 w-2',
  sm: 'h-2.5 w-2.5',
  md: 'h-3 w-3',
  lg: 'h-3.5 w-3.5',
}

const colorFromName = (name: string) => {
  const palette = [
    'from-pink-500 to-rose-600',
    'from-violet-500 to-fuchsia-600',
    'from-sky-500 to-blue-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-indigo-500 to-purple-600',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return palette[Math.abs(hash) % palette.length]
}

export const Avatar = ({ src, name, size = 'md', online, className }: AvatarProps) => {
  return (
    <div className={cn('relative inline-block shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={cn('rounded-full object-cover ring-2 ring-bg-panel', sizes[size])}
        />
      ) : (
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ring-2 ring-bg-panel',
            sizes[size],
            colorFromName(name)
          )}
        >
          {initials(name) || '?'}
        </div>
      )}
      {online && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-bg-panel bg-emerald-500',
            dotSizes[size]
          )}
        />
      )}
    </div>
  )
}
