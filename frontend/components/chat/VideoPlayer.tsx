import { cn } from '@/lib/utils'

interface VideoPlayerProps {
  src: string
  poster?: string
  className?: string
}

export const VideoPlayer = ({ src, poster, className }: VideoPlayerProps) => (
  <video
    src={src}
    poster={poster}
    controls
    preload="metadata"
    className={cn('max-h-96 w-full rounded-lg bg-black', className)}
  />
)
