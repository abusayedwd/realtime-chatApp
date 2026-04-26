import { baseApi } from './baseApi'
import type { IUser } from '@/types'

interface AuthResponse {
  accessToken: string
  user: IUser
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    register: build.mutation<{ email: string }, { name: string; email: string; password: string; confirmPassword: string }>({
      query: (body) => ({ url: '/auth/register', method: 'POST', data: body }),
    }),
    verifyEmail: build.mutation<{ email: string }, { email: string; code: string }>({
      query: (body) => ({ url: '/auth/verify-email', method: 'POST', data: body }),
    }),
    resendOtp: build.mutation<{ email: string }, { email: string }>({
      query: (body) => ({ url: '/auth/resend-otp', method: 'POST', data: body }),
    }),
    login: build.mutation<AuthResponse, { email: string; password: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', data: body }),
    }),
    refresh: build.mutation<AuthResponse, void>({
      query: () => ({ url: '/auth/refresh', method: 'POST' }),
    }),
    logout: build.mutation<null, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
    }),
  }),
})

export const {
  useRegisterMutation,
  useVerifyEmailMutation,
  useResendOtpMutation,
  useLoginMutation,
  useRefreshMutation,
  useLogoutMutation,
} = authApi
