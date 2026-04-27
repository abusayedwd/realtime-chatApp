import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface ChatState {
  activeConversationId: string | null
  typingUsers: Record<string, { userId: string; userName: string }[]>
  onlineUsers: string[]
  lastSeen: Record<string, string>
  unreadCounts: Record<string, number>
  socketConnected: boolean
}

const initialState: ChatState = {
  activeConversationId: null,
  typingUsers: {},
  onlineUsers: [],
  lastSeen: {},
  unreadCounts: {},
  socketConnected: false,
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveConversation: (state, action: PayloadAction<string | null>) => {
      state.activeConversationId = action.payload
      if (action.payload) state.unreadCounts[action.payload] = 0
    },
    setSocketConnected: (state, action: PayloadAction<boolean>) => {
      state.socketConnected = action.payload
    },
    setTyping: (
      state,
      action: PayloadAction<{
        conversationId: string
        userId: string
        userName: string
        isTyping: boolean
      }>
    ) => {
      const { conversationId, userId, userName, isTyping } = action.payload
      const list = state.typingUsers[conversationId] ?? []
      if (isTyping) {
        if (!list.find((u) => u.userId === userId)) {
          state.typingUsers[conversationId] = [...list, { userId, userName }]
        }
      } else {
        state.typingUsers[conversationId] = list.filter((u) => u.userId !== userId)
      }
    },
    setOnlineUsers: (state, action: PayloadAction<string[]>) => {
      state.onlineUsers = Array.from(new Set(action.payload))
      state.onlineUsers.forEach((userId) => {
        delete state.lastSeen[userId]
      })
    },
    userOnline: (state, action: PayloadAction<{ userId: string }>) => {
      if (!state.onlineUsers.includes(action.payload.userId)) {
        state.onlineUsers.push(action.payload.userId)
      }
      delete state.lastSeen[action.payload.userId]
    },
    userOffline: (
      state,
      action: PayloadAction<{ userId: string; lastSeen: string }>
    ) => {
      state.onlineUsers = state.onlineUsers.filter((u) => u !== action.payload.userId)
      state.lastSeen[action.payload.userId] = action.payload.lastSeen
    },
    incrementUnread: (state, action: PayloadAction<{ conversationId: string; by?: number }>) => {
      const { conversationId, by = 1 } = action.payload
      if (state.activeConversationId === conversationId) return
      state.unreadCounts[conversationId] = (state.unreadCounts[conversationId] ?? 0) + by
    },
    setUnreadCount: (
      state,
      action: PayloadAction<{ conversationId: string; count: number }>
    ) => {
      state.unreadCounts[action.payload.conversationId] = action.payload.count
    },
    resetChat: () => initialState,
  },
})

export const {
  setActiveConversation,
  setSocketConnected,
  setTyping,
  setOnlineUsers,
  userOnline,
  userOffline,
  incrementUnread,
  setUnreadCount,
  resetChat,
} = chatSlice.actions

export default chatSlice.reducer
