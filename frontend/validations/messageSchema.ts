import { z } from 'zod'

export const messageSchema = z.object({
  content: z.string().max(5000),
})

export type MessageValues = z.infer<typeof messageSchema>
