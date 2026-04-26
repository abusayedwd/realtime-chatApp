import { cn } from '@/lib/utils'

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-md bg-bg-hover', className)} />
)

export const MessageSkeleton = () => (
  <div className="flex flex-col gap-3 p-4">
    {[...Array(6)].map((_, i) => (
      <div
        key={i}
        className={cn('flex gap-2', i % 2 === 0 ? 'justify-start' : 'justify-end')}
      >
        {i % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full" />}
        <Skeleton
          className={cn('h-10', i % 3 === 0 ? 'w-48' : i % 3 === 1 ? 'w-64' : 'w-32')}
        />
      </div>
    ))}
  </div>
)

export const ConversationSkeleton = () => (
  <div className="flex flex-col">
    {[...Array(8)].map((_, i) => (
      <div key={i} className="flex items-center gap-3 border-b border-line/40 p-3">
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      </div>
    ))}
  </div>
)
