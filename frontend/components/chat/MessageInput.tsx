'use client'

import { ChangeEvent, FormEvent, KeyboardEvent, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch'
import { useTyping } from '@/hooks/useTyping'
import { uploadFile } from '@/store/api/messageApi'
import { messageApi } from '@/store/api/messageApi'
import { pushToast, toast } from '@/store/slices/uiSlice'
import { cn, uniqueById } from '@/lib/utils'
import type { IMessage } from '@/types'

const MAX_FILE_SIZE = 50 * 1024 * 1024

interface MessageInputProps {
  conversationId: string
  socket: Socket | null
}

export const MessageInput = ({ conversationId, socket }: MessageInputProps) => {
  const dispatch = useAppDispatch()
  const currentUser = useAppSelector((s) => s.auth.user)
  const accessToken = useAppSelector((s) => s.auth.accessToken)
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { onType, stopTyping } = useTyping(socket, conversationId)

  const sendText = (e?: FormEvent) => {
    e?.preventDefault()
    const content = text.trim()
    if (!content || !currentUser || !socket) return

    stopTyping()

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
      type: 'text',
      content,
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
      { conversationId, type: 'text', content, clientTempId },
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

    setText('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendText()
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
      await uploadFile(conversationId, file, accessToken, (pct) => setUploading(pct))
      // The 'new_message' socket event will insert the real message into cache.
    } catch (err) {
      const msg = (err as { message?: string }).message ?? 'Upload failed'
      dispatch(pushToast(toast.error(msg)))
    } finally {
      setUploading(null)
    }
  }

  return (
    <div className="border-t border-line bg-bg-panel px-3 py-2.5">
      {uploading !== null && (
        <div className="mb-2 flex items-center gap-3 rounded-lg border border-line bg-bg-hover px-3 py-2 text-xs text-ink-muted">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-elevated">
            <div
              className="h-full bg-brand transition-all"
              style={{ width: `${uploading}%` }}
            />
          </div>
          <span>Uploading {uploading}%</span>
        </div>
      )}

      <form onSubmit={sendText} className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-bg-hover hover:text-ink"
          aria-label="Attach file"
          disabled={uploading !== null}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
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

        <textarea
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            onType()
          }}
          onKeyDown={handleKeyDown}
          onBlur={stopTyping}
          placeholder="Type a message..."
          className="max-h-32 min-h-[40px] flex-1 resize-none rounded-2xl border border-line bg-bg-input px-4 py-2.5 text-sm text-ink placeholder:text-ink-dim outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />

        <button
          type="submit"
          disabled={!text.trim()}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition',
            text.trim()
              ? 'bg-brand text-white hover:bg-brand-dark'
              : 'bg-bg-hover text-ink-dim'
          )}
          aria-label="Send"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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
