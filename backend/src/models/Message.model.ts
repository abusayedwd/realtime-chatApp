import mongoose, { Document, Schema, Model } from 'mongoose'

export type MessageType = 'text' | 'image' | 'video' | 'file'

export interface IReadReceipt {
  user: mongoose.Types.ObjectId
  readAt: Date
}

export interface IMessageReaction {
  user: mongoose.Types.ObjectId
  emoji: string
  createdAt: Date
}

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId
  conversationId: mongoose.Types.ObjectId
  sender: mongoose.Types.ObjectId
  replyTo?: mongoose.Types.ObjectId
  type: MessageType
  content?: string
  fileUrl?: string
  fileName?: string
  fileSize?: number
  mimeType?: string
  thumbnailUrl?: string
  reactions: IMessageReaction[]
  readBy: IReadReceipt[]
  deletedFor: mongoose.Types.ObjectId[]
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    replyTo: { type: Schema.Types.ObjectId, ref: 'Message' },
    type: { type: String, enum: ['text', 'image', 'video', 'file'], default: 'text' },
    content: { type: String, trim: true },
    fileUrl: String,
    fileName: String,
    fileSize: Number,
    mimeType: String,
    thumbnailUrl: String,
    reactions: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        emoji: { type: String, required: true, trim: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    readBy: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date, default: Date.now },
      },
    ],
    deletedFor: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
)

MessageSchema.index({ conversationId: 1, createdAt: -1 })
MessageSchema.index({ sender: 1 })
MessageSchema.index({ 'readBy.user': 1 })
MessageSchema.index({ 'reactions.user': 1 })

export const Message: Model<IMessage> =
  (mongoose.models.Message as Model<IMessage>) ||
  mongoose.model<IMessage>('Message', MessageSchema)
