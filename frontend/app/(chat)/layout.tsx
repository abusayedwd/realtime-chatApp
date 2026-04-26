'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ConversationList } from '@/components/chat/ConversationList'
import { useAppSelector } from '@/hooks/useAppDispatch'

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated)
  const hydrated = useAppSelector((s) => s.auth.hydrated)

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.replace('/login')
  }, [hydrated, isAuthenticated, router])

  if (!hydrated || !isAuthenticated) return null

  return (
    // h-screen + overflow-hidden: fills the full viewport regardless of parent height chain
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      {/* Sidebar — fixed width on md+, hidden on mobile */}
      <div className="hidden h-full w-80 shrink-0 md:flex">
        <ConversationList />
      </div>

      {/* Main content area */}
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
