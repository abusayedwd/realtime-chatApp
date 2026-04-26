import { cn } from '@/lib/utils'

export const Badge = ({
  count,
  className,
}: {
  count: number
  className?: string
}) => {
  if (!count) return null
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white',
        className
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
