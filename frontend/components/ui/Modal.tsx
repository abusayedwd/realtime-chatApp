'use client'

import { ReactNode, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

export const Modal = ({ open, onClose, title, children, className }: ModalProps) => {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'animate-pop-in w-full max-w-md rounded-2xl border border-line bg-bg-panel shadow-2xl',
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h3 className="text-base font-semibold text-ink">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-ink-muted hover:bg-bg-hover hover:text-ink"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
