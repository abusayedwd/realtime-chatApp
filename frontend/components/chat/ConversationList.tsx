'use client'

import { useParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useListConversationsQuery } from '@/store/api/conversationApi'
import { useLogoutMutation } from '@/store/api/authApi'
import { ConversationItem } from './ConversationItem'
import { ConversationSkeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { NewChatModal } from './NewChatModal'
import { ProfileModal } from './ProfileModal'
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
  const [showProfile, setShowProfile] = useState(false)
  const [q, setQ] = useState('')
  const seededRef = useRef<Set<string>>(new Set())


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
    try { await logout().unwrap() } catch { /* clear locally */ }
    cleanupSocket()
    dispatch(logoutAction())
    window.location.assign('/login')
  }

  return (
    <aside className="flex h-full w-full flex-col bg-bg-panel/90 backdrop-blur-xl">
      {/* ── Header ── */}
      <header className="relative flex items-center justify-between border-b border-white/10 px-3 py-3">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="flex items-center gap-2.5 min-w-0">
          {me && (
            <div className="relative shrink-0">
              <Avatar src={me.avatar} name={me.name} size="sm" />
              <span
                className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-bg-panel shadow-[0_0_0_2px_rgba(10,10,24,0.65)] ${
                  socketConnected ? 'bg-emerald-400' : 'bg-gray-500'
                }`}
              />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink leading-tight">
              {me?.name ?? 'Me'}
            </p>
            <p className="text-[11px] text-ink-dim">
              {socketConnected ? 'Online' : 'Connecting...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
          {/* Profile / Settings */}
          <button
            onClick={() => setShowProfile(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-white/10 hover:text-ink"
            aria-label="Profile & settings"
            title="Profile & settings"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {/* New chat */}
          <button
            onClick={() => setShowNew(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-white/10 hover:text-brand-light"
            aria-label="New conversation"
            title="New conversation"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-white/10 hover:text-rose-300"
            aria-label="Sign out"
            title="Sign out"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
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

      {/* ── Search bar ── */}
      <div className="px-3 py-2.5">
        <div className="flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-bg-input/85 px-3 shadow-[0_8px_24px_rgba(0,0,0,0.2)] transition focus-within:border-brand/50 focus-within:ring-2 focus-within:ring-brand/20">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ink-muted">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search conversations…"
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-dim outline-none"
          />
          {q && (
            <button onClick={() => setQ('')} className="shrink-0 text-ink-dim hover:text-ink">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {isLoading ? (
          <ConversationSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            {q ? (
              <>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-ink-dim">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <p className="text-sm text-ink-muted">No results for <span className="font-medium text-ink">"{q}"</span></p>
                <button onClick={() => setQ('')} className="text-xs text-brand hover:text-brand-light">
                  Clear search
                </button>
              </>
            ) : (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-hover text-ink-dim">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">No conversations yet</p>
                  <p className="mt-1 text-xs text-ink-dim">Press + to start chatting</p>
                </div>
                <button
                  onClick={() => setShowNew(true)}
                  className="mt-1 rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-dark"
                >
                  New conversation
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1 py-1">
            {filtered.map((c) => (
              <ConversationItem key={c._id} conversation={c} active={c._id === activeId} />
            ))}
          </div>
        )}
      </div>

      <NewChatModal open={showNew} onClose={() => setShowNew(false)} />
      <ProfileModal open={showProfile} onClose={() => setShowProfile(false)} />
    </aside>
  )
}
