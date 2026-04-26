import { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-y-auto overflow-x-hidden bg-bg px-4 py-10">
      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-indigo-600/15 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        {/* App badge */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-bg-panel/70 px-4 py-1.5 text-xs font-medium text-ink-muted backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-brand" /> ChatApp
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-line bg-bg-panel/90 p-8 shadow-2xl backdrop-blur">
          {children}
        </div>
      </div>
    </main>
  )
}
