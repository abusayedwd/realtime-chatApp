import mongoose, { Document, Schema, Model } from 'mongoose'

export interface IConversation extends Document {
  _id: mongoose.Types.ObjectId
  participants: mongoose.Types.ObjectId[]
  isGroup: boolean
  groupName?: string
  groupAvatar?: string
  groupAdmin?: mongoose.Types.ObjectId
  lastMessage?: mongoose.Types.ObjectId
  lastMessageAt: Date
  createdAt: Date
  updatedAt: Date
}

const ConversationSchema = new Schema<IConversation>(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    isGroup: { type: Boolean, default: false },
    groupName: { type: String, trim: true },
    groupAvatar: String,
    groupAdmin: { type: Schema.Types.ObjectId, ref: 'User' },
    lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

ConversationSchema.index({ participants: 1 })
ConversationSchema.index({ lastMessageAt: -1 })
ConversationSchema.index({ participants: 1, isGroup: 1 })

export const Conversation: Model<IConversation> =
  (mongoose.models.Conversation as Model<IConversation>) ||
  mongoose.model<IConversation>('Conversation', ConversationSchema)
