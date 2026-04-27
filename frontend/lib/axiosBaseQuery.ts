import axios, { AxiosError, AxiosRequestConfig } from 'axios'
import type { BaseQueryFn } from '@reduxjs/toolkit/query'

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5006/api'

export const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

export interface AxiosBaseQueryArgs {
  url: string
  method?: AxiosRequestConfig['method']
  data?: unknown
  params?: Record<string, unknown>
  headers?: Record<string, string>
}

export interface AxiosBaseQueryError {
  status: number
  data: unknown
  message: string
}

export const axiosBaseQuery =
  (): BaseQueryFn<AxiosBaseQueryArgs, unknown, AxiosBaseQueryError> =>
  async ({ url, method = 'GET', data, params, headers }, api) => {
    try {
      // Pull access token from Redux store via api.getState
      const state = api.getState() as { auth?: { accessToken: string | null } }
      const token = state.auth?.accessToken
      const response = await axiosInstance({
        url,
        method,
        data,
        params,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
      })
      // Unwrap our ApiResponse envelope → return both data and meta
      if (response.data && typeof response.data === 'object' && 'data' in response.data) {
        return { data: response.data.data, meta: response.data.meta }
      }
      return { data: response.data }
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>
      return {
        error: {
          status: error.response?.status ?? 0,
          data: error.response?.data ?? null,
          message: error.response?.data?.message ?? error.message,
        },
      }
    }
  }
