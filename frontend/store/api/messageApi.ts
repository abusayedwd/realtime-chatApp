import { baseApi } from './baseApi'
import type { IMessage, PaginatedMeta } from '@/types'
import { axiosInstance } from '@/lib/axiosBaseQuery'
import { uniqueById } from '@/lib/utils'

interface GetMessagesArgs {
  conversationId: string
  page?: number
  limit?: number
}

interface MessagesPage {
  items: IMessage[]
  meta?: PaginatedMeta
}

interface SendMessageArgs {
  conversationId: string
  type?: 'text' | 'image' | 'video' | 'file'
  content?: string
  fileUrl?: string
  fileName?: string
  fileSize?: number
  mimeType?: string
  thumbnailUrl?: string
}

export const messageApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMessages: build.query<MessagesPage, GetMessagesArgs>({
      query: ({ conversationId, page = 1, limit = 30 }) => ({
        url: `/messages/${conversationId}`,
        method: 'GET',
        params: { page, limit },
      }),
      transformResponse: (response: IMessage[], meta) => ({
        items: response,
        // `axiosBaseQuery` returns `{ data, meta }` — RTK Query forwards `meta` as-is.
        meta: meta as PaginatedMeta | undefined,
      }),
      // Serialize by conversationId only so pages merge into one cache entry
      serializeQueryArgs: ({ queryArgs }) => ({ conversationId: queryArgs.conversationId }),
      merge: (existing, incoming, { arg }) => {
        const page = arg.page ?? 1
        if (page === 1) return incoming
        return {
          items: uniqueById([...incoming.items, ...existing.items]),
          meta: incoming.meta ?? existing.meta,
        }
      },
      forceRefetch: ({ currentArg, previousArg }) =>
        (currentArg?.page ?? 1) !== (previousArg?.page ?? 1) ||
        currentArg?.conversationId !== previousArg?.conversationId,
      providesTags: (_r, _e, { conversationId }) => [{ type: 'Message', id: conversationId }],
    }),

    sendMessage: build.mutation<IMessage, SendMessageArgs>({
      query: ({ conversationId, ...body }) => ({
        url: `/messages/${conversationId}`,
        method: 'POST',
        data: body,
      }),
      // Optimistic: the socket 'new_message' event will add the real copy.
      // We invalidate Conversation list so sidebar reorders on success.
      invalidatesTags: [{ type: 'Conversation', id: 'LIST' }],
    }),

    markAsRead: build.mutation<{ messageIds: string[] }, { conversationId: string; messageIds: string[] }>({
      query: ({ conversationId, messageIds }) => ({
        url: `/messages/${conversationId}/read`,
        method: 'PATCH',
        data: { messageIds },
      }),
    }),

    deleteMessage: build.mutation<{ messageId: string }, { messageId: string; conversationId: string }>({
      query: ({ messageId }) => ({ url: `/messages/${messageId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { conversationId }) => [{ type: 'Message', id: conversationId }],
    }),
  }),
})

export const {
  useGetMessagesQuery,
  useLazyGetMessagesQuery,
  useSendMessageMutation,
  useMarkAsReadMutation,
  useDeleteMessageMutation,
} = messageApi

/**
 * File upload uses axios directly (not RTK Query) so we can pass a progress
 * callback. The caller dispatches the resulting message through the socket /
 * manual cache update.
 */
export const uploadFile = async (
  conversationId: string,
  file: File,
  accessToken: string | null,
  onProgress?: (pct: number) => void
): Promise<IMessage> => {
  const form = new FormData()
  form.append('file', file)
  const res = await axiosInstance.post(`/messages/${conversationId}/upload`, form, {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
    },
  })
  return res.data.data as IMessage
}
