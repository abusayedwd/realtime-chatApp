import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId')

export const sendMessageSchema = z.object({
  params: z.object({ conversationId: objectId }),
  body: z.object({
    type: z.enum(['text', 'image', 'video', 'file']).default('text'),
    content: z.string().max(5000).optional(),
    fileUrl: z.string().url().optional(),
    fileName: z.string().optional(),
    fileSize: z.number().int().nonnegative().optional(),
    mimeType: z.string().optional(),
    thumbnailUrl: z.string().url().optional(),
  }),
})

export const getMessagesSchema = z.object({
  params: z.object({ conversationId: objectId }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(30),
    before: z.string().optional(),
  }),
})

export const markReadSchema = z.object({
  params: z.object({ conversationId: objectId }),
  body: z.object({ messageIds: z.array(objectId).min(1) }),
})

export const createConversationSchema = z.object({
  body: z.object({ participantId: objectId }),
})

export const searchUsersSchema = z.object({
  query: z.object({
    q: z.string().min(1).max(50),
    limit: z.coerce.number().int().min(1).max(25).default(10),
  }),
})

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(50).trim().optional(),
    avatar: z.string().url().optional(),
  }),
})
