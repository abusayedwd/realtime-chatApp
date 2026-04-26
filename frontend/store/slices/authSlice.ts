import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { IUser } from '@/types'

interface AuthState {
  user: IUser | null
  accessToken: string | null
  isAuthenticated: boolean
  hydrated: boolean
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  hydrated: false,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ accessToken: string; user: IUser }>
    ) => {
      state.accessToken = action.payload.accessToken
      state.user = action.payload.user
      state.isAuthenticated = true
      state.hydrated = true
    },
    updateUser: (state, action: PayloadAction<Partial<IUser>>) => {
      if (state.user) state.user = { ...state.user, ...action.payload }
    },
    setHydrated: (state) => {
      state.hydrated = true
    },
    logoutAction: (state) => {
      state.accessToken = null
      state.user = null
      state.isAuthenticated = false
      state.hydrated = true
    },
  },
})

export const { setCredentials, updateUser, setHydrated, logoutAction } = authSlice.actions
export default authSlice.reducer
