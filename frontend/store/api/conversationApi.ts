import { baseApi } from './baseApi'
import type { IConversation } from '@/types'

export const conversationApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listConversations: build.query<IConversation[], void>({
      query: () => ({ url: '/conversations', method: 'GET' }),
      providesTags: (result) =>
        result
          ? [
              ...result.map((c) => ({ type: 'Conversation' as const, id: c._id })),
              { type: 'Conversation' as const, id: 'LIST' },
            ]
          : [{ type: 'Conversation' as const, id: 'LIST' }],
    }),
    getConversation: build.query<IConversation, string>({
      query: (id) => ({ url: `/conversations/${id}`, method: 'GET' }),
      providesTags: (_r, _e, id) => [{ type: 'Conversation', id }],
    }),
    createOrGetDM: build.mutation<IConversation, { participantId: string }>({
      query: (body) => ({ url: '/conversations', method: 'POST', data: body }),
      invalidatesTags: [{ type: 'Conversation', id: 'LIST' }],
    }),
    updateBackground: build.mutation<IConversation, { id: string; background: string }>({
      query: ({ id, background }) => ({
        url: `/conversations/${id}/background`,
        method: 'PATCH',
        data: { background },
      }),
      // Optimistically update both cache entries so the change is instant
      async onQueryStarted({ id, background }, { dispatch, queryFulfilled }) {
        const patchList = dispatch(
          conversationApi.util.updateQueryData('listConversations', undefined, (draft) => {
            const c = draft.find((x) => x._id === id)
            if (c) c.background = background
          })
        )
        const patchOne = dispatch(
          conversationApi.util.updateQueryData('getConversation', id, (draft) => {
            draft.background = background
          })
        )
        try {
          await queryFulfilled
        } catch {
          patchList.undo()
          patchOne.undo()
        }
      },
    }),
    deleteConversation: build.mutation<null, string>({
      query: (id) => ({ url: `/conversations/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Conversation', id },
        { type: 'Conversation', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useListConversationsQuery,
  useGetConversationQuery,
  useCreateOrGetDMMutation,
  useUpdateBackgroundMutation,
  useDeleteConversationMutation,
} = conversationApi
