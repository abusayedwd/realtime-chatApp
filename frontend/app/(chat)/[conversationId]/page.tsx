'use client'

import { useParams } from 'next/navigation'
import { ChatWindow } from '@/components/chat/ChatWindow'

export default function ConversationPage() {
  const params = useParams()
  const conversationId = params?.conversationId as string | undefined
  if (!conversationId) return null
  return <ChatWindow conversationId={conversationId} />
}
