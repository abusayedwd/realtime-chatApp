import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from './providers'
import { SessionBootstrap } from './SessionBootstrap'

export const metadata: Metadata = {
  title: 'ChatApp — Real-time messaging',
  description: 'Production-grade real-time chat application',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f0f1a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        <Providers>
          <SessionBootstrap>{children}</SessionBootstrap>
        </Providers>
      </body>
    </html>
  )
}
