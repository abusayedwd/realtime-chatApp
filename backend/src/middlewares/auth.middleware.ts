import { Request, Response, NextFunction } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { env } from '../config/env'
import { ApiError } from '../utils/ApiError'

export interface AuthPayload extends JwtPayload {
  userId: string
  email: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
      throw new ApiError(401, 'Not authorized — missing access token')
    }
    const token = header.slice(7)
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthPayload
    req.user = decoded
    next()
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) return next(new ApiError(401, 'Access token expired'))
    if (err instanceof jwt.JsonWebTokenError) return next(new ApiError(401, 'Invalid access token'))
    next(err)
  }
}
