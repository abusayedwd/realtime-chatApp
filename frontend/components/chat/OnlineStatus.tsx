'use client'

import { useAppSelector } from '@/hooks/useAppDispatch'
import { formatRelative } from '@/lib/utils'

export const OnlineStatus = ({
  userId,
  fallbackLastSeen,
}: {
  userId: string
  fallbackLastSeen?: string
}) => {
  const isOnline = useAppSelector((s) => s.chat.onlineUsers.includes(userId))
  const liveLastSeen = useAppSelector((s) => s.chat.lastSeen[userId])
  const lastSeen = liveLastSeen ?? fallbackLastSeen

  if (isOnline) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Online
      </span>
    )
  }
  return (
    <span className="text-xs text-ink-dim">
      {lastSeen ? `Last seen ${formatRelative(lastSeen)}` : 'Offline'}
    </span>
  )
}
