import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { baseApi } from './api/baseApi'
import authReducer from './slices/authSlice'
import chatReducer from './slices/chatSlice'
import uiReducer from './slices/uiSlice'

export const makeStore = () =>
  configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
      chat: chatReducer,
      ui: uiReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        },
      }).concat(baseApi.middleware),
  })

export const store = makeStore()

setupListeners(store.dispatch)

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
