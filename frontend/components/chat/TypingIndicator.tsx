'use client'

import { useAppSelector } from '@/hooks/useAppDispatch'

export const TypingIndicator = ({ conversationId }: { conversationId: string }) => {
  const users = useAppSelector((s) => s.chat.typingUsers[conversationId] ?? [])
  if (users.length === 0) return null

  const label =
    users.length === 1
      ? `${users[0].userName || 'Someone'} is typing`
      : users.length === 2
        ? `${users[0].userName} and ${users[1].userName} are typing`
        : 'Several people are typing'

  return (
    <div className="flex items-center gap-2 px-4 py-1 text-xs text-ink-muted">
      <div className="flex items-end gap-0.5">
        <span className="h-1.5 w-1.5 animate-typing-bounce rounded-full bg-ink-muted" />
        <span className="h-1.5 w-1.5 animate-typing-bounce rounded-full bg-ink-muted [animation-delay:120ms]" />
        <span className="h-1.5 w-1.5 animate-typing-bounce rounded-full bg-ink-muted [animation-delay:240ms]" />
      </div>
      <span>{label}...</span>
    </div>
  )
}
