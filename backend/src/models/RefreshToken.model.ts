import mongoose, { Document, Schema, Model } from 'mongoose'

export interface IRefreshToken extends Document {
  userId: mongoose.Types.ObjectId
  hash: string
  expiresAt: Date
  createdAt: Date
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
)

// MongoDB TTL index — automatically deletes expired tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
RefreshTokenSchema.index({ userId: 1, hash: 1 })

export const RefreshToken: Model<IRefreshToken> =
  (mongoose.models.RefreshToken as Model<IRefreshToken>) ||
  mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema)
