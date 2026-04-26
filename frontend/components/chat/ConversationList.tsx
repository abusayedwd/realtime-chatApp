'use client'

import { useParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useListConversationsQuery } from '@/store/api/conversationApi'
import { useLogoutMutation } from '@/store/api/authApi'
import { ConversationItem } from './ConversationItem'
import { ConversationSkeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { NewChatModal } from './NewChatModal'
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch'
import { logoutAction } from '@/store/slices/authSlice'
import { setUnreadCount } from '@/store/slices/chatSlice'
import { cleanupSocket } from '@/hooks/useSocket'

export const ConversationList = () => {
  const params = useParams()
  const activeId = params?.conversationId as string | undefined
  const dispatch = useAppDispatch()
  const me = useAppSelector((s) => s.auth.user)
  const socketConnected = useAppSelector((s) => s.chat.socketConnected)
  const { data, isLoading } = useListConversationsQuery()
  const [logout] = useLogoutMutation()
  const [showNew, setShowNew] = useState(false)
  const [q, setQ] = useState('')
  const seededRef = useRef<Set<string>>(new Set())

  // Seed unread counts from server, but only once per conversation so that
  // locally-cleared counts (via setActiveConversation) aren't overwritten.
  useEffect(() => {
    if (!data) return
    data.forEach((c) => {
      if (!seededRef.current.has(c._id)) {
        dispatch(setUnreadCount({ conversationId: c._id, count: c.unreadCount ?? 0 }))
        seededRef.current.add(c._id)
      }
    })
  }, [data, dispatch])

  const filtered = useMemo(() => {
    if (!data) return []
    if (!q.trim()) return data
    const term = q.trim().toLowerCase()
    return data.filter((c) => {
      if (c.isGroup) return c.groupName?.toLowerCase().includes(term)
      return c.participants.some(
        (p) =>
          p._id !== me?.id &&
          (p.name.toLowerCase().includes(term) || p.email.toLowerCase().includes(term))
      )
    })
  }, [data, q, me?.id])

  const onLogout = async () => {
    try {
      await logout().unwrap()
    } catch {
      // still clear locally
    }
    cleanupSocket()
    dispatch(logoutAction())
    window.location.assign('/login')
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-line bg-bg-panel">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-3">
          {me && <Avatar src={me.avatar} name={me.name} online={socketConnected} size="sm" />}
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-ink">{me?.name ?? 'Me'}</span>
            <span className="text-[11px] text-ink-dim">
              {socketConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowNew(true)}
            className="rounded-lg p-2 text-ink-muted transition hover:bg-bg-hover hover:text-ink"
            aria-label="New chat"
            title="Start a new conversation"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 12h-8m0 0H4m8 0V4m0 8v8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            onClick={onLogout}
            className="rounded-lg p-2 text-ink-muted transition hover:bg-bg-hover hover:text-ink"
            aria-label="Logout"
            title="Sign out"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l-5-5 5-5M5 12h12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <div className="border-b border-line px-3 py-2">
        <div className="flex h-9 items-center gap-2 rounded-lg border border-line bg-bg-input px-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-ink-muted">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search conversations"
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-dim outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <ConversationSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <p className="text-sm text-ink-muted">
              {q ? 'No conversations match your search' : 'No conversations yet'}
            </p>
            {!q && (
              <button
                onClick={() => setShowNew(true)}
                className="text-sm font-medium text-brand hover:text-brand-light"
              >
                Start a conversation
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((c) => (
              <ConversationItem key={c._id} conversation={c} active={c._id === activeId} />
            ))}
          </div>
        )}
      </div>

      <NewChatModal open={showNew} onClose={() => setShowNew(false)} />
    </aside>
  )
}
