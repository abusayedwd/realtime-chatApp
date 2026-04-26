import { baseApi } from './baseApi'
import type { IUser } from '@/types'
import { axiosInstance } from '@/lib/axiosBaseQuery'

export const userApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMe: build.query<IUser, void>({
      query: () => ({ url: '/users/me', method: 'GET' }),
      providesTags: ['User'],
    }),
    updateMe: build.mutation<IUser, { name?: string; avatar?: string }>({
      query: (body) => ({ url: '/users/me', method: 'PUT', data: body }),
      invalidatesTags: ['User'],
    }),
    searchUsers: build.query<IUser[], { q: string; limit?: number }>({
      query: ({ q, limit = 10 }) => ({
        url: '/users/search',
        method: 'GET',
        params: { q, limit },
      }),
    }),
  }),
})

export const { useGetMeQuery, useUpdateMeMutation, useSearchUsersQuery, useLazySearchUsersQuery } =
  userApi

/** Upload avatar — returns updated IUser */
export const uploadAvatar = async (
  file: File,
  accessToken: string | null
): Promise<IUser> => {
  const form = new FormData()
  form.append('avatar', file)
  const res = await axiosInstance.post('/users/me/avatar', form, {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })
  return res.data.data as IUser
}
