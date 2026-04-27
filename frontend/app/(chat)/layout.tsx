'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ConversationList } from '@/components/chat/ConversationList'
import { useAppSelector } from '@/hooks/useAppDispatch'
import { cn } from '@/lib/utils'

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const params = useParams()
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated)
  const hydrated = useAppSelector((s) => s.auth.hydrated)

  const hasConversation = Boolean(params?.conversationId)

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.replace('/login')
  }, [hydrated, isAuthenticated, router])

  if (!hydrated || !isAuthenticated) return null

  return (
    <div className="h-[100dvh] overflow-hidden bg-bg lg:p-4">
      <div
        className="mx-auto flex h-full w-full overflow-hidden bg-bg lg:h-[calc(100dvh-2rem)] lg:max-w-[1380px] lg:rounded-3xl lg:border lg:border-white/10 lg:shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
      >
        {/*
         * SIDEBAR
         * Mobile  (<md): full-width when no conversation open, hidden when chat is open
         * Tablet  (md):  240px, always visible
         * Desktop (lg):  320px, always visible
         */}
        <div
          className={cn(
            'h-full shrink-0 border-r border-line/70',
            // mobile: toggle between full-screen sidebar and hidden
            hasConversation ? 'hidden' : 'flex w-full',
            // tablet+: always show at fixed width
            'md:flex md:w-60 lg:w-80',
          )}
        >
          <ConversationList />
        </div>

        {/*
         * MAIN PANEL
         * Mobile (<md): full-width when conversation open, hidden on home
         * Tablet+: fills remaining space
         */}
        <div
          className={cn(
            'h-full min-w-0 flex-1 flex-col overflow-hidden',
            // mobile: show chat only if a conversation is open
            hasConversation ? 'flex' : 'hidden',
            // tablet+: always visible
            'md:flex',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
