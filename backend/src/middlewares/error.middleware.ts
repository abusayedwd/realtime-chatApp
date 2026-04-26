import { Request, Response, NextFunction } from 'express'
import { MongoServerError } from 'mongodb'
import { ApiError } from '../utils/ApiError'
import { logger } from '../utils/logger'
import { env } from '../config/env'

export const notFound = (req: Request, _res: Response, next: NextFunction) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`))
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  let status = 500
  let message = 'Internal Server Error'
  let details: unknown

  if (err instanceof ApiError) {
    status = err.statusCode
    message = err.message
    details = err.details
  } else if (err instanceof Error) {
    const anyErr = err as Error & { code?: number; keyValue?: Record<string, unknown> }
    if (err.name === 'ValidationError') {
      status = 400
      message = err.message
    } else if (err.name === 'CastError') {
      status = 400
      message = 'Invalid resource identifier'
    } else if (err instanceof MongoServerError && anyErr.code === 11000) {
      status = 409
      message = `Duplicate value: ${JSON.stringify(anyErr.keyValue ?? {})}`
    } else {
      message = err.message
    }
  }

  if (status >= 500) logger.error(`${req.method} ${req.originalUrl} →`, err)
  else logger.warn(`${req.method} ${req.originalUrl} → ${status}: ${message}`)

  res.status(status).json({
    success: false,
    message,
    ...(details !== undefined ? { details } : {}),
    ...(env.NODE_ENV !== 'production' && err instanceof Error ? { stack: err.stack } : {}),
  })
}
