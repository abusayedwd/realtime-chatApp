import { cn } from '@/lib/utils'

interface ReadReceiptProps {
  /** 'sending' → clock | 'sent' → 1 grey tick | 'delivered' → 2 grey | 'read' → 2 blue */
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
}

export const ReadReceipt = ({ status }: ReadReceiptProps) => {
  if (status === 'sending')
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white/60" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )

  if (status === 'failed')
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-red-300" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7v5M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )

  const doubleTick = status === 'delivered' || status === 'read'
  const color = status === 'read' ? 'text-sky-300' : 'text-white/60'

  return (
    <svg viewBox="0 0 24 24" className={cn('h-3.5 w-4', color)} fill="none" aria-hidden>
      <path d="M2 13l4 4 8-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {doubleTick && (
        <path d="M9 13l4 4 8-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  )
}
