export class ApiError extends Error {
  public readonly statusCode: number
  public readonly isOperational: boolean
  public readonly details?: unknown

  constructor(statusCode: number, message: string, details?: unknown, isOperational = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.details = details
    Error.captureStackTrace?.(this, this.constructor)
  }
}
