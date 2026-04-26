export interface IUser {
  id: string
  name: string
  email: string
  avatar?: string
  isVerified: boolean
  isOnline: boolean
  lastSeen: string
  createdAt: string
}

export type MessageType = 'text' | 'image' | 'video' | 'file'

export interface IReadReceipt {
  user: string
  readAt: string
}

export interface IMessageSender {
  _id: string
  name: string
  email: string
  avatar?: string
}

export interface IMessage {
  _id: string
  conversationId: string
  sender: IMessageSender | string
  type: MessageType
  content?: string
  fileUrl?: string
  fileName?: string
  fileSize?: number
  mimeType?: string
  thumbnailUrl?: string
  readBy: IReadReceipt[]
  deletedFor: string[]
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  /** client-only, for optimistic bubbles */
  clientTempId?: string
  /** client-only, 'sending' | 'sent' | 'failed' */
  status?: 'sending' | 'sent' | 'failed'
}

export interface IConversationParticipant {
  _id: string
  name: string
  email: string
  avatar?: string
  isOnline: boolean
  lastSeen: string
}

export interface IConversation {
  _id: string
  participants: IConversationParticipant[]
  isGroup: boolean
  groupName?: string
  groupAvatar?: string
  groupAdmin?: string
  lastMessage?: Pick<IMessage, '_id' | 'content' | 'type' | 'sender' | 'createdAt' | 'fileName'>
  lastMessageAt: string
  background?: string
  unreadCount?: number
  createdAt: string
  updatedAt: string
}

export interface PaginatedMeta {
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
  meta?: PaginatedMeta
}
