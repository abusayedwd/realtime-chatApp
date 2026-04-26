'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLazyGetMessagesQuery } from '@/store/api/messageApi'

export const useInfiniteMessages = (conversationId: string | null) => {
  const [trigger, state] = useLazyGetMessagesQuery()
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const loadingRef = useRef(false)

  useEffect(() => {
    if (!conversationId) return
    setPage(1)
    setHasMore(true)
    loadingRef.current = true
    trigger({ conversationId, page: 1, limit: 30 })
      .unwrap()
      .then((res) => setHasMore(res.meta?.hasMore ?? false))
      .finally(() => {
        loadingRef.current = false
      })
  }, [conversationId, trigger])

  const loadMore = useCallback(async () => {
    if (!conversationId || loadingRef.current || !hasMore) return
    loadingRef.current = true
    try {
      const next = page + 1
      const res = await trigger({ conversationId, page: next, limit: 30 }).unwrap()
      setPage(next)
      setHasMore(res.meta?.hasMore ?? false)
    } finally {
      loadingRef.current = false
    }
  }, [conversationId, page, hasMore, trigger])

  return { messages: state.data?.items ?? [], hasMore, loadMore, isFetching: state.isFetching }
}
