import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { cloudinary } from '../config/cloudinary'
import { env } from '../config/env'
import { ApiError } from '../utils/ApiError'

export interface UploadedFile {
  url: string
  thumbnailUrl?: string
  publicId: string
  mimeType: string
  bytes: number
  originalName: string
}

type ResourceType = 'image' | 'video' | 'raw'

const pickResourceType = (mime: string): ResourceType => {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  return 'raw'
}

const isCloudinaryConfigured = (): boolean =>
  Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET)

// ── Cloudinary upload ──────────────────────────────────────────────────────────
const uploadToCloudinary = (
  buffer: Buffer,
  file: Express.Multer.File
): Promise<UploadedFile> =>
  new Promise((resolve, reject) => {
    const resourceType = pickResourceType(file.mimetype)
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType, folder: 'chatapp', use_filename: true, unique_filename: true },
      (error, result) => {
        if (error || !result) {
          return reject(new ApiError(502, `Cloudinary upload failed: ${error?.message ?? 'unknown'}`))
        }
        const thumbnailUrl =
          resourceType === 'video'
            ? cloudinary.url(result.public_id, {
                resource_type: 'video',
                format: 'jpg',
                transformation: [{ width: 400, crop: 'scale' }],
              })
            : undefined

        resolve({
          url: result.secure_url,
          thumbnailUrl,
          publicId: result.public_id,
          mimeType: file.mimetype,
          bytes: result.bytes,
          originalName: file.originalname,
        })
      }
    )
    stream.end(buffer)
  })

// ── Local disk upload (dev fallback when Cloudinary is not configured) ─────────
const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

const ensureUploadsDir = () => {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

const uploadToLocal = async (
  buffer: Buffer,
  file: Express.Multer.File
): Promise<UploadedFile> => {
  ensureUploadsDir()

  const ext = path.extname(file.originalname) || ''
  const filename = `${crypto.randomUUID()}${ext}`
  const dest = path.join(UPLOADS_DIR, filename)

  fs.writeFileSync(dest, buffer)

  // Build public URL — backend serves /uploads/* as static
  const url = `${env.SERVER_URL}/uploads/${filename}`

  return {
    url,
    thumbnailUrl: undefined,
    publicId: filename,
    mimeType: file.mimetype,
    bytes: buffer.length,
    originalName: file.originalname,
  }
}

// ── Public entry point ─────────────────────────────────────────────────────────
export const uploadBufferToCloudinary = async (
  buffer: Buffer,
  file: Express.Multer.File
): Promise<UploadedFile> => {
  if (isCloudinaryConfigured()) {
    return uploadToCloudinary(buffer, file)
  }
  // Dev fallback
  return uploadToLocal(buffer, file)
}
