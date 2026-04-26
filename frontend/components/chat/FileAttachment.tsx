import { cn, formatBytes } from '@/lib/utils'

interface FileAttachmentProps {
  url: string
  name?: string
  size?: number
  mimeType?: string
  isOwn?: boolean
}

export const FileAttachment = ({ url, name, size, mimeType, isOwn }: FileAttachmentProps) => (
  <a
    href={url}
    download={name}
    target="_blank"
    rel="noreferrer"
    className={cn(
      'flex max-w-xs items-center gap-3 rounded-lg border px-3 py-2.5 transition',
      isOwn
        ? 'border-white/20 bg-white/10 hover:bg-white/20'
        : 'border-line bg-bg-hover hover:bg-bg-elevated'
    )}
  >
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
        isOwn ? 'bg-white/15' : 'bg-brand/20 text-brand'
      )}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    </div>
    <div className="flex min-w-0 flex-1 flex-col">
      <span className={cn('truncate text-sm font-medium', isOwn ? 'text-white' : 'text-ink')}>
        {name ?? 'file'}
      </span>
      <span className={cn('text-[11px]', isOwn ? 'text-white/70' : 'text-ink-dim')}>
        {[mimeType, size && formatBytes(size)].filter(Boolean).join(' · ')}
      </span>
    </div>
  </a>
)
