'use client'

import { useRef } from 'react'
import type { ChatBg } from '@/hooks/useChatBg'
import { DEFAULT_BG_ID } from '@/hooks/useChatBg'
import { CHAT_PRESETS, CATEGORY_LABELS } from '@/lib/chatPresets'
import type { ChatPreset } from '@/lib/chatPresets'

/** Compress + resize image to a manageable data URL (max 1024px, JPEG 0.8) */
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const MAX = 1024
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width >= height) { height = Math.round((height * MAX) / width); width = MAX }
        else { width = Math.round((width * MAX) / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas')); return }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = reject
    img.src = objectUrl
  })
}

interface Props {
  open: boolean
  onClose: () => void
  current: ChatBg
  onSelectPreset: (id: string) => void
  onSelectCustom: (dataUrl: string) => void
  onReset: () => void
}

const CATEGORY_ORDER: ChatPreset['category'][] = ['patterns', 'dark', 'gradients', 'colorful']

export const ConversationBgPicker = ({
  open, onClose, current, onSelectPreset, onSelectCustom, onReset,
}: Props) => {
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const compressed = await compressImage(file)
      onSelectCustom(compressed)
      onClose()
    } catch {
      // Fallback to raw FileReader if canvas fails
      const reader = new FileReader()
      reader.onload = (ev) => {
        onSelectCustom(ev.target?.result as string)
        onClose()
      }
      reader.readAsDataURL(file)
    }
  }

  const activeId = current.type === 'preset' ? current.value : null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-line bg-bg-panel shadow-2xl animate-pop-in overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink">Chat Wallpaper</p>
            <p className="mt-0.5 text-[11px] text-ink-dim leading-tight">
              Presets sync for both · Custom is yours only
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-3 shrink-0 rounded-lg p-1 text-ink-muted transition hover:bg-bg-hover hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="max-h-[420px] overflow-y-auto overscroll-contain p-3 space-y-4">

          {/* Preset sections by category */}
          {CATEGORY_ORDER.map((cat) => {
            const group = CHAT_PRESETS.filter((p) => p.category === cat)
            if (group.length === 0) return null
            return (
              <div key={cat}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-dim">
                  {CATEGORY_LABELS[cat]}
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {group.map((preset) => {
                    const isActive = activeId === preset.id
                    return (
                      <button
                        key={preset.id}
                        title={preset.label}
                        onClick={() => { onSelectPreset(preset.id); onClose() }}
                        className={`group relative h-12 w-full overflow-hidden rounded-xl border-2 transition-all duration-150 ${
                          isActive
                            ? 'border-brand scale-105 shadow-lg shadow-brand/40'
                            : 'border-transparent hover:border-white/20 hover:scale-105'
                        }`}
                        style={{ backgroundColor: preset.swatch, ...preset.style }}
                      >

                        {/* Active checkmark */}
                        {isActive && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                            <div className="rounded-full bg-brand/90 p-0.5">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                                <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          </div>
                        )}

                        {/* Hover label */}
                        <div className="absolute inset-x-0 bottom-0 translate-y-full transition-transform duration-150 group-hover:translate-y-0">
                          <div className="bg-black/60 px-1 py-0.5 text-center text-[9px] text-white leading-tight truncate">
                            {preset.label}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Custom section */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-dim">
              Custom Image
            </p>

            {/* Active custom preview */}
            {current.type === 'custom' && (
              <div
                className="mb-2 h-16 w-full overflow-hidden rounded-xl border-2 border-brand"
                style={{
                  backgroundImage: `url(${current.value})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div className="flex h-full items-center justify-end p-2 bg-gradient-to-r from-transparent to-black/40">
                  <span className="rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    Active
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-ink-muted transition hover:border-brand/50 hover:bg-brand/5 hover:text-ink"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0">
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M3 15l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                </svg>
                <span className="text-sm">Upload from device</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                onChange={handleFile}
              />

              <button
                onClick={() => { onSelectPreset(DEFAULT_BG_ID); onClose() }}
                className="w-full rounded-xl border border-line py-2 text-xs text-ink-dim transition hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-400"
              >
                Reset to default
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
