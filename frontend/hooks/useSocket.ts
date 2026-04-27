'use client'

import { useEffect, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import { getSocket, disconnectSocket } from '@/lib/socket'
import { useAppDispatch, useAppSelector } from './useAppDispatch'
import {
  setSocketConnected,
  setTyping,
  userOnline,
  userOffline,
  incrementUnread,
  setOnlineUsers,
  setUnreadCount,
} from '@/store/slices/chatSlice'
import { messageApi } from '@/store/api/messageApi'
import { conversationApi } from '@/store/api/conversationApi'
import { getSenderId, uniqueById } from '@/lib/utils'
import type { IMessage } from '@/types'

export const useSocket = () => {
  const dispatch = useAppDispatch()
  const accessToken = useAppSelector((s) => s.auth.accessToken)
  const currentUserId = useAppSelector((s) => s.auth.user?.id)
  const activeConversationId = useAppSelector((s) => s.chat.activeConversationId)
  const socketRef = useRef<Socket | null>(null)
  const activeRef = useRef<string | null>(null)

  useEffect(() => {
    activeRef.current = activeConversationId
  }, [activeConversationId])

  useEffect(() => {
    if (!accessToken || !currentUserId) return

    const socket = getSocket(accessToken)
    socketRef.current = socket

    const syncOnlineUsers = () => {
      socket.emit('get_online_users', null, (res: { userIds: string[] }) => {
        if (res?.userIds) dispatch(setOnlineUsers(res.userIds))
      })
    }

    let lastPresenceSyncAt = 0

    const markUserActive = () => {
      if (document.visibilityState !== 'visible') return
      if (socket.connected) {
        const now = Date.now()
        if (now - lastPresenceSyncAt > 10_000) {
          lastPresenceSyncAt = now
          syncOnlineUsers()
        }
      } else {
        socket.connect()
      }
    }

    const onConnect = () => {
      dispatch(setSocketConnected(true))
      syncOnlineUsers()
      lastPresenceSyncAt = Date.now()
      dispatch(conversationApi.util.invalidateTags([{ type: 'Conversation', id: 'LIST' }]))
      if (activeRef.current) {
        dispatch(messageApi.util.invalidateTags([{ type: 'Message', id: activeRef.current }]))
        dispatch(
          messageApi.endpoints.getMessages.initiate(
            { conversationId: activeRef.current, page: 1, limit: 30 },
            { forceRefetch: true }
          )
        )
      }
    }
    const onDisconnect = () => {
      dispatch(setSocketConnected(false))
    }

    const onNewMessage = ({ message, clientTempId }: { message: IMessage; clientTempId?: string }) => {
      const senderId = getSenderId(message.sender)

      // Insert into RTK Query cache for this conversation
      dispatch(
        messageApi.util.updateQueryData(
          'getMessages',
          { conversationId: message.conversationId },
          (draft) => {
            if (!draft) return
            if (clientTempId) {
              const idx = draft.items.findIndex((m) => m.clientTempId === clientTempId)
              if (idx !== -1) {
                draft.items[idx] = { ...message, status: 'sent' }
                return
              }
            }
            draft.items = uniqueById([...draft.items, message])
          }
        )
      )

      // Update list cache immediately (don't wait for refetch)
      let listUpdated = false
      dispatch(
        conversationApi.util.updateQueryData('listConversations', undefined, (draft) => {
          const idx = draft.findIndex((c) => c._id === message.conversationId)
          if (idx === -1) return
          const convo = draft[idx]
          listUpdated = true
          convo.lastMessage = {
            _id: message._id,
            content: message.content,
            type: message.type,
            sender: message.sender,
            createdAt: message.createdAt,
            fileName: message.fileName,
          }
          convo.lastMessageAt = message.createdAt
          // Keep sidebar ordering in sync with newest activity.
          if (idx > 0) {
            const [item] = draft.splice(idx, 1)
            draft.unshift(item)
          }
        })
      )
      if (!listUpdated) {
        dispatch(conversationApi.util.invalidateTags([{ type: 'Conversation', id: 'LIST' }]))
      }

      // Unread badge — only when the conversation is not currently open
      if (senderId !== currentUserId && activeRef.current !== message.conversationId) {
        dispatch(incrementUnread({ conversationId: message.conversationId }))
      } else if (activeRef.current === message.conversationId) {
        dispatch(setUnreadCount({ conversationId: message.conversationId, count: 0 }))
      }
    }

    const onMessagesRead = ({
      conversationId,
      messageIds,
      readBy,
    }: {
      conversationId: string
      messageIds: string[]
      readBy: string
    }) => {
      dispatch(
        messageApi.util.updateQueryData('getMessages', { conversationId }, (draft) => {
          if (!draft) return
          const ids = new Set(messageIds)
          draft.items.forEach((m) => {
            if (ids.has(m._id) && !m.readBy.some((r) => r.user === readBy)) {
              m.readBy.push({ user: readBy, readAt: new Date().toISOString() })
            }
          })
        })
      )
      if (readBy === currentUserId) {
        dispatch(setUnreadCount({ conversationId, count: 0 }))
      }
    }

    const onTyping = ({
      userId,
      userName,
      conversationId,
      isTyping,
    }: {
      userId: string
      userName?: string
      conversationId: string
      isTyping: boolean
    }) => {
      dispatch(setTyping({ conversationId, userId, userName: userName ?? '', isTyping }))
    }

    const onUserOnline = ({ userId }: { userId: string }) => dispatch(userOnline({ userId }))
    const onUserOffline = ({ userId, lastSeen }: { userId: string; lastSeen: string }) =>
      dispatch(userOffline({ userId, lastSeen }))

    const onMessageDeleted = ({
      conversationId,
      messageId,
      forEveryone,
    }: {
      conversationId: string
      messageId: string
      forEveryone: boolean
    }) => {
      dispatch(
        messageApi.util.updateQueryData('getMessages', { conversationId }, (draft) => {
          if (!draft) return
          if (forEveryone) {
            const m = draft.items.find((x) => x._id === messageId)
            if (m) {
              m.isDeleted = true
              m.content = ''
              m.fileUrl = undefined
              m.thumbnailUrl = undefined
            }
          } else {
            draft.items = draft.items.filter((x) => x._id !== messageId)
          }
        })
      )
    }

    const onMessageUpdated = ({
      conversationId,
      message,
    }: {
      conversationId: string
      message: IMessage
    }) => {
      dispatch(
        messageApi.util.updateQueryData('getMessages', { conversationId }, (draft) => {
          if (!draft) return
          const idx = draft.items.findIndex((x) => x._id === message._id)
          if (idx !== -1) draft.items[idx] = message
        })
      )
    }

    const onUnreadCountUpdated = ({
      conversationId,
      count,
    }: {
      conversationId: string
      count: number
    }) => {
      const next = activeRef.current === conversationId ? 0 : count
      dispatch(setUnreadCount({ conversationId, count: next }))
    }

    const onConversationUpdated = ({
      conversationId,
      lastMessage,
      lastMessageAt,
    }: {
      conversationId: string
      lastMessage: IMessage
      lastMessageAt: string
    }) => {
      let found = false
      dispatch(
        conversationApi.util.updateQueryData('listConversations', undefined, (draft) => {
          const idx = draft.findIndex((c) => c._id === conversationId)
          if (idx === -1) return
          found = true
          const convo = draft[idx]
          convo.lastMessage = {
            _id: lastMessage._id,
            content: lastMessage.content,
            type: lastMessage.type,
            sender: lastMessage.sender,
            createdAt: lastMessage.createdAt,
            fileName: lastMessage.fileName,
          }
          convo.lastMessageAt = lastMessageAt
          if (idx > 0) {
            const [item] = draft.splice(idx, 1)
            draft.unshift(item)
          }
        })
      )
      if (!found) {
        dispatch(conversationApi.util.invalidateTags([{ type: 'Conversation', id: 'LIST' }]))
      }
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('new_message', onNewMessage)
    socket.on('messages_read', onMessagesRead)
    socket.on('typing', onTyping)
    socket.on('user_online', onUserOnline)
    socket.on('user_offline', onUserOffline)
    socket.on('message_deleted', onMessageDeleted)
    socket.on('message_updated', onMessageUpdated)
    socket.on('unread_count_updated', onUnreadCountUpdated)
    socket.on('conversation_updated', onConversationUpdated)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (socket.connected) socket.disconnect()
      } else {
        markUserActive()
      }
    }
    const onPageHide = () => {
      if (socket.connected) socket.disconnect()
    }
    window.addEventListener('focus', markUserActive)
    window.addEventListener('pointerdown', markUserActive)
    window.addEventListener('keydown', markUserActive)
    window.addEventListener('touchstart', markUserActive, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)

    // Keep realtime reliable while tab is visible.
    if (document.visibilityState === 'visible') {
      if (socket.connected) onConnect()
      else socket.connect()
    } else if (socket.connected) {
      socket.disconnect()
    }

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('new_message', onNewMessage)
      socket.off('messages_read', onMessagesRead)
      socket.off('typing', onTyping)
      socket.off('user_online', onUserOnline)
      socket.off('user_offline', onUserOffline)
      socket.off('message_deleted', onMessageDeleted)
      socket.off('message_updated', onMessageUpdated)
      socket.off('unread_count_updated', onUnreadCountUpdated)
      socket.off('conversation_updated', onConversationUpdated)
      window.removeEventListener('focus', markUserActive)
      window.removeEventListener('pointerdown', markUserActive)
      window.removeEventListener('keydown', markUserActive)
      window.removeEventListener('touchstart', markUserActive)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [accessToken, currentUserId, dispatch])

  useEffect(() => {
    return () => {
      // On full logout/unmount — caller controls when to disconnect.
    }
  }, [])

  return socketRef
}

export const cleanupSocket = () => disconnectSocket()
