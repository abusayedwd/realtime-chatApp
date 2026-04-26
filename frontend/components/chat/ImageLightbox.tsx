'use client'

import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch'
import { closeLightbox } from '@/store/slices/uiSlice'

export const ImageLightbox = () => {
  const url = useAppSelector((s) => s.ui.lightboxUrl)
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (!url) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch(closeLightbox())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [url, dispatch])

  if (!url) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-fade-in"
      onClick={() => dispatch(closeLightbox())}
    >
      <img
        src={url}
        alt=""
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        onClick={() => dispatch(closeLightbox())}
        aria-label="Close"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
