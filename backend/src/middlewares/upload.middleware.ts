import multer, { FileFilterCallback } from 'multer'
import { Request } from 'express'
import { ApiError } from '../utils/ApiError'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'text/plain',
])

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) cb(null, true)
  else cb(new ApiError(400, `File type not allowed: ${file.mimetype}`))
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter,
})
