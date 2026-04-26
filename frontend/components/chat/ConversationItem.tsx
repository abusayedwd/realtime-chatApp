'use client'

import { useRouter } from 'next/navigation'
import { useAppSelector } from '@/hooks/useAppDispatch'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn, formatRelative, getSenderId } from '@/lib/utils'
import type { IConversation } from '@/types'

interface ConversationItemProps {
  conversation: IConversation
  active: boolean
}

const previewText = (c: IConversation, meId: string | undefined) => {
  const m = c.lastMessage
  if (!m) return 'No messages yet'
  const prefix = getSenderId(m.sender) === meId ? 'You: ' : ''
  if (m.type === 'text') return `${prefix}${m.content ?? ''}`
  if (m.type === 'image') return `${prefix}📷 Photo`
  if (m.type === 'video') return `${prefix}🎥 Video`
  if (m.type === 'file') return `${prefix}📎 ${m.fileName ?? 'File'}`
  return ''
}

export const ConversationItem = ({ conversation, active }: ConversationItemProps) => {
  const router = useRouter()
  const me = useAppSelector((s) => s.auth.user)
  const unread = useAppSelector(
    (s) => s.chat.unreadCounts[conversation._id] ?? conversation.unreadCount ?? 0
  )
  const typingUsers = useAppSelector((s) => s.chat.typingUsers[conversation._id] ?? [])
  const onlineUsers = useAppSelector((s) => s.chat.onlineUsers)

  const other = conversation.participants.find((p) => p._id !== me?.id)
  const name = conversation.isGroup
    ? conversation.groupName ?? 'Group'
    : other?.name ?? 'Unknown'
  const avatar = conversation.isGroup ? conversation.groupAvatar : other?.avatar
  const online = other ? onlineUsers.includes(other._id) : false

  const preview = typingUsers.length > 0 ? 'typing...' : previewText(conversation, me?.id)

  return (
    <button
      onClick={() => router.push(`/${conversation._id}`)}
      className={cn(
        'group flex w-full items-center gap-3 px-3 py-2.5 text-left transition',
        active ? 'bg-bg-hover' : 'hover:bg-bg-hover'
      )}
    >
      <Avatar src={avatar} name={name} online={online} size="md" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn('truncate text-sm font-semibold text-ink', unread && 'text-ink')}>
            {name}
          </span>
          <span className="shrink-0 text-[11px] text-ink-dim">
            {formatRelative(conversation.lastMessageAt)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span
            className={cn(
              'truncate text-xs',
              typingUsers.length > 0
                ? 'italic text-brand-light'
                : unread
                  ? 'font-medium text-ink'
                  : 'text-ink-muted'
            )}
          >
            {preview}
          </span>
          <Badge count={unread} />
        </div>
      </div>
    </button>
  )
}
