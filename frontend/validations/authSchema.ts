import { z } from 'zod'

export const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(50),
    email: z.string().email('Enter a valid email'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/\d/, 'Must contain a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
})

export type RegisterValues = z.infer<typeof registerSchema>
export type LoginValues = z.infer<typeof loginSchema>
export type VerifyEmailValues = z.infer<typeof verifyEmailSchema>
