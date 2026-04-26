import { z } from 'zod'

const passwordRule = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Must contain uppercase, lowercase, and a number')

export const registerSchema = z.object({
  body: z
    .object({
      name: z.string().min(2).max(50).trim(),
      email: z.string().email().toLowerCase(),
      password: passwordRule,
      confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: "Passwords don't match",
      path: ['confirmPassword'],
    }),
})

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email().toLowerCase(),
    password: z.string().min(1),
  }),
})

export const verifyEmailSchema = z.object({
  body: z.object({
    email: z.string().email().toLowerCase(),
    code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
  }),
})

export const resendOtpSchema = z.object({
  body: z.object({ email: z.string().email().toLowerCase() }),
})

export const forgotPasswordSchema = z.object({
  body: z.object({ email: z.string().email().toLowerCase() }),
})

export const resetPasswordSchema = z.object({
  body: z
    .object({
      email: z.string().email().toLowerCase(),
      token: z.string().min(1, 'Token is required'),
      password: passwordRule,
      confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: "Passwords don't match",
      path: ['confirmPassword'],
    }),
})

export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: passwordRule,
      confirmNewPassword: z.string(),
    })
    .refine((d) => d.newPassword === d.confirmNewPassword, {
      message: "Passwords don't match",
      path: ['confirmNewPassword'],
    }),
})

export type RegisterInput = z.infer<typeof registerSchema>['body']
export type LoginInput = z.infer<typeof loginSchema>['body']
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>['body']
export type ResendOtpInput = z.infer<typeof resendOtpSchema>['body']
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>['body']
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>['body']
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body']
