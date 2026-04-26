import mongoose, { Document, Schema, Model } from 'mongoose'
import bcrypt from 'bcryptjs'

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  email: string
  password: string
  avatar?: string
  isVerified: boolean
  emailVerificationCode?: string
  emailVerificationExpires?: Date
  otpAttempts: number
  otpLockedUntil?: Date
  lastOtpSentAt?: Date
  passwordResetToken?: string
  passwordResetExpires?: Date
  isOnline: boolean
  lastSeen: Date
  createdAt: Date
  updatedAt: Date
  comparePassword(password: string): Promise<boolean>
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, minlength: 8, select: false },
    avatar: { type: String, default: '' },
    isVerified: { type: Boolean, default: false },
    emailVerificationCode: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    otpAttempts: { type: Number, default: 0, select: false },
    otpLockedUntil: { type: Date, select: false },
    lastOtpSentAt: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

UserSchema.index({ name: 'text', email: 'text' })
UserSchema.index({ isOnline: 1 })

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

UserSchema.methods.comparePassword = async function (password: string) {
  return bcrypt.compare(password, this.password)
}

UserSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: unknown, ret: any) => {
    delete ret.password
    delete ret.emailVerificationCode
    delete ret.emailVerificationExpires
    delete ret.otpAttempts
    delete ret.otpLockedUntil
    delete ret.lastOtpSentAt
    delete ret.passwordResetToken
    delete ret.passwordResetExpires
    delete ret.__v
    return ret
  },
})

export const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', UserSchema)
