'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Input'
import { useLazySearchUsersQuery } from '@/store/api/userApi'
import { useCreateOrGetDMMutation } from '@/store/api/conversationApi'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { pushToast, toast } from '@/store/slices/uiSlice'

interface NewChatModalProps {
  open: boolean
  onClose: () => void
}

export const NewChatModal = ({ open, onClose }: NewChatModalProps) => {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const [q, setQ] = useState('')
  const [trigger, { data: results, isFetching }] = useLazySearchUsersQuery()
  const [createDM, { isLoading: creating }] = useCreateOrGetDMMutation()

  useEffect(() => {
    if (!open) {
      setQ('')
      return
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      if (q.trim()) trigger({ q: q.trim(), limit: 10 })
    }, 250)
    return () => clearTimeout(t)
  }, [q, open, trigger])

  const start = async (userId: string) => {
    try {
      const convo = await createDM({ participantId: userId }).unwrap()
      onClose()
      router.push(`/${convo._id}`)
    } catch (err) {
      const msg = (err as { message?: string }).message ?? 'Could not start conversation'
      dispatch(pushToast(toast.error(msg)))
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New conversation">
      <Input
        placeholder="Search by name or email..."
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        }
      />

      <div className="mt-4 max-h-80 overflow-y-auto">
        {q.trim() === '' ? (
          <p className="py-8 text-center text-sm text-ink-dim">Start typing to search users...</p>
        ) : isFetching ? (
          <p className="py-8 text-center text-sm text-ink-dim">Searching...</p>
        ) : results && results.length > 0 ? (
          <div className="divide-y divide-line/40">
            {results.map((u) => (
              <button
                key={u.id}
                disabled={creating}
                onClick={() => start(u.id)}
                className="flex w-full items-center gap-3 px-1 py-2 text-left transition hover:bg-bg-hover disabled:opacity-60"
              >
                <Avatar src={u.avatar} name={u.name} online={u.isOnline} size="sm" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-ink">{u.name}</span>
                  <span className="truncate text-xs text-ink-muted">{u.email}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-ink-dim">No users found</p>
        )}
      </div>
    </Modal>
  )
}
