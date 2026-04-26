import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

interface UiState {
  sidebarOpen: boolean
  lightboxUrl: string | null
  toasts: Toast[]
}

const initialState: UiState = {
  sidebarOpen: true,
  lightboxUrl: null,
  toasts: [],
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen
    },
    setSidebar: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload
    },
    openLightbox: (state, action: PayloadAction<string>) => {
      state.lightboxUrl = action.payload
    },
    closeLightbox: (state) => {
      state.lightboxUrl = null
    },
    pushToast: (state, action: PayloadAction<Toast>) => {
      state.toasts.push(action.payload)
    },
    dismissToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload)
    },
  },
})

export const {
  toggleSidebar,
  setSidebar,
  openLightbox,
  closeLightbox,
  pushToast,
  dismissToast,
} = uiSlice.actions

export default uiSlice.reducer

const genId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for non-secure contexts (plain HTTP on LAN, etc.)
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

export const toast = {
  success: (message: string): Toast => ({ id: genId(), type: 'success', message }),
  error: (message: string): Toast => ({ id: genId(), type: 'error', message }),
  info: (message: string): Toast => ({ id: genId(), type: 'info', message }),
}
