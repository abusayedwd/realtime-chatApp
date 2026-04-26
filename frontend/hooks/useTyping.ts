'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Socket } from 'socket.io-client'

const STOP_DELAY_MS = 1500

export const useTyping = (socket: Socket | null, conversationId: string | null) => {
  const isTyping = useRef(false)
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const emitStart = useCallback(() => {
    if (!socket || !conversationId) return
    if (!isTyping.current) {
      socket.emit('typing_start', { conversationId })
      isTyping.current = true
    }
    if (stopTimer.current) clearTimeout(stopTimer.current)
    stopTimer.current = setTimeout(() => {
      socket.emit('typing_stop', { conversationId })
      isTyping.current = false
    }, STOP_DELAY_MS)
  }, [socket, conversationId])

  const emitStopNow = useCallback(() => {
    if (!socket || !conversationId) return
    if (stopTimer.current) clearTimeout(stopTimer.current)
    if (isTyping.current) {
      socket.emit('typing_stop', { conversationId })
      isTyping.current = false
    }
  }, [socket, conversationId])

  useEffect(() => {
    return () => {
      if (stopTimer.current) clearTimeout(stopTimer.current)
    }
  }, [])

  return { onType: emitStart, stopTyping: emitStopNow }
}
