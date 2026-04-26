'use client'

import { Provider } from 'react-redux'
import { store } from '@/store'
import { ToastViewport } from '@/components/ui/Toast'
import { ImageLightbox } from '@/components/chat/ImageLightbox'

export const Providers = ({ children }: { children: React.ReactNode }) => (
  <Provider store={store}>
    {children}
    <ToastViewport />
    <ImageLightbox />
  </Provider>
)
