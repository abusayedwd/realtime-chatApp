import { Response } from 'express'

export interface ApiPayload<T> {
  success: true
  message: string
  data: T
  meta?: Record<string, unknown>
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'OK',
  statusCode = 200,
  meta?: Record<string, unknown>
) => {
  const body: ApiPayload<T> = { success: true, message, data, ...(meta ? { meta } : {}) }
  return res.status(statusCode).json(body)
}

export const sendCreated = <T>(res: Response, data: T, message = 'Created') =>
  sendSuccess(res, data, message, 201)
