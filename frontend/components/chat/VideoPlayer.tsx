import { cn, downloadFile } from '@/lib/utils'

interface VideoPlayerProps {
  src: string
  poster?: string
  fileName?: string
  className?: string
}

export const VideoPlayer = ({ src, poster, fileName, className }: VideoPlayerProps) => (
  <div className="group/media relative">
    <video
      src={src}
      poster={poster}
      controls
      preload="metadata"
      className={cn('max-h-96 w-full rounded-lg bg-black', className)}
    />
    <button
      type="button"
      onClick={() => downloadFile(src, fileName)}
      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition hover:bg-black/70 group-hover/media:opacity-100"
      aria-label="Download video"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  </div>
)
