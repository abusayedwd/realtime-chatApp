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

    if (!socket.connected) socket.connect()

    const onConnect = () => {
      dispatch(setSocketConnected(true))
      socket.emit('get_online_users', null, (res: { userIds: string[] }) => {
        if (res?.userIds) dispatch(setOnlineUsers(res.userIds))
      })
    }
    const onDisconnect = () => dispatch(setSocketConnected(false))

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

      // Conversation list needs to reorder / show the new lastMessage
      dispatch(conversationApi.util.invalidateTags([{ type: 'Conversation', id: 'LIST' }]))

      // Unread badge — only when the conversation is not currently open
      if (senderId !== currentUserId && activeRef.current !== message.conversationId) {
        dispatch(incrementUnread({ conversationId: message.conversationId }))
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

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('new_message', onNewMessage)
    socket.on('messages_read', onMessagesRead)
    socket.on('typing', onTyping)
    socket.on('user_online', onUserOnline)
    socket.on('user_offline', onUserOffline)
    socket.on('message_deleted', onMessageDeleted)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('new_message', onNewMessage)
      socket.off('messages_read', onMessagesRead)
      socket.off('typing', onTyping)
      socket.off('user_online', onUserOnline)
      socket.off('user_offline', onUserOffline)
      socket.off('message_deleted', onMessageDeleted)
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
