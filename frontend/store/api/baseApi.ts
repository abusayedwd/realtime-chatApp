import { createApi, BaseQueryFn } from '@reduxjs/toolkit/query/react'
import { axiosBaseQuery, AxiosBaseQueryArgs, AxiosBaseQueryError } from '@/lib/axiosBaseQuery'
import { setCredentials, logoutAction } from '../slices/authSlice'
import type { IUser } from '@/types'

/**
 * Tiny inline mutex — prevents multiple parallel /auth/refresh calls when
 * several requests race to 401 at the same time.
 */
let refreshInFlight: Promise<boolean> | null = null

const rawBaseQuery = axiosBaseQuery()

export const baseQueryWithReauth: BaseQueryFn<
  AxiosBaseQueryArgs,
  unknown,
  AxiosBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions)

  if (result.error?.status !== 401 || args.url === '/auth/refresh') {
    return result
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshResult = await rawBaseQuery(
        { url: '/auth/refresh', method: 'POST' },
        api,
        extraOptions
      )
      if (refreshResult.data) {
        const { accessToken, user } = refreshResult.data as {
          accessToken: string
          user: IUser
        }
        api.dispatch(setCredentials({ accessToken, user }))
        return true
      }
      api.dispatch(logoutAction())
      return false
    })()
  }

  const ok = await refreshInFlight
  refreshInFlight = null

  if (!ok) return result
  return rawBaseQuery(args, api, extraOptions)
}

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['User', 'Conversation', 'Message'],
  endpoints: () => ({}),
})
