import { Request, Response, NextFunction } from 'express'
import { AnyZodObject, ZodError } from 'zod'
import { ApiError } from '../utils/ApiError'

export const validate =
  (schema: AnyZodObject) => async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const result = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })
      if (result.body) req.body = result.body
      if (result.query) Object.assign(req.query, result.query)
      if (result.params) Object.assign(req.params, result.params)
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.flatten().fieldErrors
        return next(new ApiError(400, 'Validation failed', details))
      }
      next(err)
    }
  }
