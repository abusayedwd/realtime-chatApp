'use client'

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { Socket } from 'socket.io-client'
import type { EmojiClickData } from 'emoji-picker-react'
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch'
import { useTyping } from '@/hooks/useTyping'
import { uploadFile } from '@/store/api/messageApi'
import { messageApi } from '@/store/api/messageApi'
import { pushToast, toast } from '@/store/slices/uiSlice'
import { cn, uniqueById } from '@/lib/utils'
import type { IMessage } from '@/types'

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false })

const MAX_FILE_SIZE = 50 * 1024 * 1024
const GIPHY_API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY
const TENOR_API_KEY = process.env.NEXT_PUBLIC_TENOR_API_KEY ?? 'LIVDSRZULELA'
const TENOR_CLIENT_KEY = 'chatapp-web'

interface GifItem {
  id: string
  url: string
  previewUrl: string
  title: string
}

interface MessageInputProps {
  conversationId: string
  socket: Socket | null
  replyTo?: IMessage | null
  onCancelReply?: () => void
}

export const MessageInput = ({
  conversationId,
  socket,
  replyTo,
  onCancelReply,
}: MessageInputProps) => {
  const dispatch = useAppDispatch()
  const currentUser = useAppSelector((s) => s.auth.user)
  const accessToken = useAppSelector((s) => s.auth.accessToken)
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState<number | null>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showGif, setShowGif] = useState(false)
  const [gifQuery, setGifQuery] = useState('')
  const [gifItems, setGifItems] = useState<GifItem[]>([])
  const [gifLoading, setGifLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)
  const gifRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { onType, stopTyping } = useTyping(socket, conversationId)

  // Auto-resize textarea height
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [text])

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmoji) return
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showEmoji])

  useEffect(() => {
    if (!showGif) return
    const handler = (e: MouseEvent) => {
      if (gifRef.current && !gifRef.current.contains(e.target as Node)) {
        setShowGif(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showGif])

  useEffect(() => {
    if (!showGif) return

    const controller = new AbortController()
    const q = gifQuery.trim()

    const loadFromGiphy = async (): Promise<GifItem[]> => {
      if (!GIPHY_API_KEY) return []
      const endpoint = q
        ? `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(GIPHY_API_KEY)}&q=${encodeURIComponent(q)}&limit=24&rating=pg&lang=en`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(GIPHY_API_KEY)}&limit=24&rating=pg`
      const res = await fetch(endpoint, { signal: controller.signal })
      if (!res.ok) throw new Error('GIPHY fetch failed')
      const json = (await res.json()) as {
        data?: Array<{
          id?: string
          title?: string
          images?: {
            original?: { url?: string }
            fixed_width_small?: { url?: string }
          }
        }>
      }
      return (json.data ?? [])
        .map((it) => {
          const url = it.images?.original?.url
          const previewUrl = it.images?.fixed_width_small?.url ?? url
          if (!url || !previewUrl) return null
          return {
            id: it.id ?? `${Math.random()}`,
            url,
            previewUrl,
            title: it.title ?? 'GIF',
          }
        })
        .filter((x): x is GifItem => Boolean(x))
    }

    const loadFromTenor = async (): Promise<GifItem[]> => {
      const endpoint = q
        ? `https://g.tenor.com/v1/search?key=${encodeURIComponent(TENOR_API_KEY)}&client_key=${encodeURIComponent(TENOR_CLIENT_KEY)}&q=${encodeURIComponent(q)}&limit=24&contentfilter=medium`
        : `https://g.tenor.com/v1/trending?key=${encodeURIComponent(TENOR_API_KEY)}&client_key=${encodeURIComponent(TENOR_CLIENT_KEY)}&limit=24&contentfilter=medium`
      const res = await fetch(endpoint, { signal: controller.signal })
      if (!res.ok) throw new Error('Tenor fetch failed')
      const json = (await res.json()) as {
        results?: Array<{
          id?: string
          title?: string
          content_description?: string
          media?: Array<{
            gif?: { url?: string }
            tinygif?: { url?: string }
          }>
        }>
      }
      return (json.results ?? [])
        .map((it) => {
          const media = it.media?.[0]
          const url = media?.gif?.url
          const previewUrl = media?.tinygif?.url ?? url
          if (!url || !previewUrl) return null
          return {
            id: it.id ?? `${Math.random()}`,
            url,
            previewUrl,
            title: it.content_description || it.title || 'GIF',
          }
        })
        .filter((x): x is GifItem => Boolean(x))
    }

    const t = setTimeout(async () => {
      try {
        setGifLoading(true)
        const giphyItems = await loadFromGiphy().catch(() => [])
        const items = giphyItems.length > 0 ? giphyItems : await loadFromTenor()
        setGifItems(items)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          dispatch(pushToast(toast.error('Could not load GIF list')))
        }
      } finally {
        setGifLoading(false)
      }
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(t)
    }
  }, [showGif, gifQuery, dispatch])

  const onEmojiClick = (data: EmojiClickData) => {
    setText((prev) => prev + data.emoji)
    textareaRef.current?.focus()
  }

  const keepFocus = () => {
    // RAF ensures focus runs after React re-render (keeps mobile keyboard open)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
  }

  const sendText = (e?: FormEvent) => {
    e?.preventDefault()
    const content = text.trim()
    if (!content || !currentUser || !socket) return

    stopTyping()
    setShowEmoji(false)
    setText('')
    keepFocus() // keep keyboard open on mobile

    const clientTempId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2, 9)

    const optimistic: IMessage = {
      _id: clientTempId,
      conversationId,
      sender: {
        _id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        avatar: currentUser.avatar,
      },
      replyTo: replyTo
        ? {
            _id: replyTo._id,
            sender: replyTo.sender,
            type: replyTo.type,
            content: replyTo.content,
            fileName: replyTo.fileName,
            isDeleted: replyTo.isDeleted,
          }
        : undefined,
      type: 'text',
      content,
      reactions: [],
      readBy: [{ user: currentUser.id, readAt: new Date().toISOString() }],
      deletedFor: [],
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      clientTempId,
      status: 'sending',
    }

    dispatch(
      messageApi.util.updateQueryData('getMessages', { conversationId }, (draft) => {
        if (!draft) return
        draft.items = uniqueById([...draft.items, optimistic])
      })
    )

    socket.emit(
      'send_message',
      { conversationId, type: 'text', content, clientTempId, replyTo: replyTo?._id },
      (res: { ok: boolean; message?: IMessage; error?: string; clientTempId?: string }) => {
        if (!res.ok) {
          dispatch(
            messageApi.util.updateQueryData('getMessages', { conversationId }, (draft) => {
              if (!draft) return
              const m = draft.items.find((x) => x.clientTempId === clientTempId)
              if (m) m.status = 'failed'
            })
          )
          dispatch(pushToast(toast.error(res.error ?? 'Failed to send message')))
        }
      }
    )
    onCancelReply?.()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendText()
    } else if (e.key === 'Escape') {
      setShowEmoji(false)
    } else {
      onType()
    }
  }

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      dispatch(pushToast(toast.error('File too large (max 50MB)')))
      return
    }
    try {
      setUploading(0)
      await uploadFile(
        conversationId,
        file,
        accessToken,
        { replyTo: replyTo?._id },
        (pct) => setUploading(pct)
      )
      onCancelReply?.()
    } catch (err) {
      const msg = (err as { message?: string }).message ?? 'Upload failed'
      dispatch(pushToast(toast.error(msg)))
    } finally {
      setUploading(null)
    }
  }

  const sendGif = async (url: string, title = 'GIF') => {
    const cleanUrl = url.trim()
    if (!url || !currentUser || !socket) return
    if (!/^https?:\/\//i.test(cleanUrl)) {
      dispatch(pushToast(toast.error('Invalid GIF URL')))
      return
    }

    const clientTempId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2, 9)

    const optimistic: IMessage = {
      _id: clientTempId,
      conversationId,
      sender: {
        _id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        avatar: currentUser.avatar,
      },
      replyTo: replyTo
        ? {
            _id: replyTo._id,
            sender: replyTo.sender,
            type: replyTo.type,
            content: replyTo.content,
            fileName: replyTo.fileName,
            isDeleted: replyTo.isDeleted,
          }
        : undefined,
      type: 'image',
      fileUrl: cleanUrl,
      fileName: title,
      mimeType: 'image/gif',
      reactions: [],
      readBy: [{ user: currentUser.id, readAt: new Date().toISOString() }],
      deletedFor: [],
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      clientTempId,
      status: 'sending',
    }

    dispatch(
      messageApi.util.updateQueryData('getMessages', { conversationId }, (draft) => {
        if (!draft) return
        draft.items = uniqueById([...draft.items, optimistic])
      })
    )

    socket.emit(
      'send_message',
      {
        conversationId,
        type: 'image',
        fileUrl: cleanUrl,
        fileName: title,
        mimeType: 'image/gif',
        clientTempId,
        replyTo: replyTo?._id,
      },
      (res: { ok: boolean; error?: string }) => {
        if (!res.ok) {
          dispatch(
            messageApi.util.updateQueryData('getMessages', { conversationId }, (draft) => {
              if (!draft) return
              const m = draft.items.find((x) => x.clientTempId === clientTempId)
              if (m) m.status = 'failed'
            })
          )
          dispatch(pushToast(toast.error(res.error ?? 'Failed to send GIF')))
        }
      }
    )

    setGifQuery('')
    setShowGif(false)
    onCancelReply?.()
  }

  const canSend = text.trim().length > 0

  return (
    <div className="relative shrink-0 border-t border-line bg-bg-panel">
      {replyTo && (
        <div className="flex items-start justify-between gap-3 border-b border-line/70 bg-bg-hover/60 px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-brand-light">Replying message</p>
            <p className="truncate text-xs text-ink-muted">
              {replyTo.isDeleted
                ? 'Deleted message'
                : replyTo.type === 'text'
                  ? replyTo.content || 'Text'
                  : replyTo.fileName || `${replyTo.type} attachment`}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="shrink-0 rounded-md p-1 text-ink-dim transition hover:bg-white/10 hover:text-ink"
            aria-label="Cancel reply"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Emoji picker popover */}
      {showEmoji && (
        <div ref={emojiRef} className="absolute bottom-full left-0 right-0 z-50 sm:left-3 sm:right-auto">
          <EmojiPicker
            onEmojiClick={onEmojiClick}
            theme={'dark' as never}
            skinTonesDisabled
            searchPlaceholder="Search emoji…"
            height={340}
            width={typeof window !== 'undefined' && window.innerWidth < 480 ? window.innerWidth : 320}
          />
        </div>
      )}

      {showGif && (
        <div
          ref={gifRef}
          className="absolute bottom-full left-0 right-0 z-50 mb-2 rounded-2xl border border-white/10 bg-bg-panel p-3 shadow-2xl sm:left-3 sm:right-auto sm:w-[380px]"
        >
          <p className="mb-2 text-xs font-medium text-ink">Search GIF</p>
          <input
            value={gifQuery}
            onChange={(e) => setGifQuery(e.target.value)}
            placeholder="Search GIFs..."
            className="w-full rounded-xl border border-white/10 bg-bg-input px-3 py-2 text-xs text-ink placeholder:text-ink-dim outline-none focus:border-brand/50"
          />
          <div className="mt-2 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">
            {gifLoading ? (
              <div className="col-span-2 py-6 text-center text-xs text-ink-dim">Loading GIFs...</div>
            ) : gifItems.length === 0 ? (
              <div className="col-span-2 py-6 text-center text-xs text-ink-dim">No GIF found</div>
            ) : (
              gifItems.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => sendGif(gif.url, gif.title)}
                  className="overflow-hidden rounded-lg border border-white/10 transition hover:border-brand/40"
                  title={gif.title}
                >
                  <img src={gif.previewUrl} alt={gif.title} className="h-24 w-full object-cover" />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Upload progress bar */}
      {uploading !== null && (
        <div className="flex items-center gap-3 border-b border-line bg-bg-hover px-4 py-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg-elevated">
            <div
              className="h-full bg-brand transition-all duration-300"
              style={{ width: `${uploading}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-ink-muted">Uploading {uploading}%</span>
        </div>
      )}

      {/* Input row */}
      <form
        onSubmit={sendText}
        className="flex items-end gap-1 px-2 py-2 sm:px-3 sm:py-2.5"
      >
        {/* Attach */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading !== null}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-dim transition hover:bg-bg-hover hover:text-ink active:scale-95 disabled:opacity-40"
          aria-label="Attach file"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 11.5l-9.19 9.19a5 5 0 01-7.07-7.07l9.19-9.19a3.5 3.5 0 114.95 4.95L9.7 18.55a2 2 0 01-2.83-2.83L15.4 7.2"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <input ref={fileRef} type="file" hidden onChange={handleFile} />

        {/* Emoji */}
        <button
          type="button"
          onClick={() => setShowEmoji((v) => !v)}
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95',
            showEmoji ? 'bg-brand/15 text-brand' : 'text-ink-dim hover:bg-bg-hover hover:text-ink'
          )}
          aria-label="Emoji"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="9" cy="10" r="1.2" fill="currentColor" />
            <circle cx="15" cy="10" r="1.2" fill="currentColor" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => {
            setShowEmoji(false)
            setShowGif((v) => !v)
          }}
          className={cn(
            'flex h-9 items-center justify-center rounded-full px-2 text-[11px] font-semibold transition active:scale-95',
            showGif ? 'bg-brand/15 text-brand' : 'text-ink-dim hover:bg-bg-hover hover:text-ink'
          )}
          aria-label="Send GIF"
        >
          GIF
        </button>

        {/* Text area — pill style */}
        <div className="relative flex flex-1 items-end overflow-hidden rounded-2xl border border-line bg-bg-input focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-brand/20 transition">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              onType()
            }}
            onKeyDown={handleKeyDown}
            onBlur={stopTyping}
            placeholder="Message…"
            className="max-h-28 w-full resize-none bg-transparent px-4 py-2.5 text-sm text-ink placeholder:text-ink-dim outline-none"
            style={{ minHeight: '38px' }}
          />
        </div>

        {/* Send button */}
        <button
          type="submit"
          disabled={!canSend}
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-150 active:scale-95',
            canSend
              ? 'bg-brand text-white shadow-sm shadow-brand/30 hover:bg-brand-dark'
              : 'bg-bg-hover text-ink-dim'
          )}
          aria-label="Send"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            className={cn('transition-transform', canSend && 'translate-x-px')}
          >
            <path
              d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>
    </div>
  )
}
