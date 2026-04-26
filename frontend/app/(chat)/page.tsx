// Desktop only — on mobile the sidebar IS the home, so this page is hidden
export default function ChatHomePage() {
  return (
    <section className="relative hidden h-full flex-1 items-center justify-center overflow-hidden bg-bg md:flex">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/10 blur-[120px]" />
      </div>
      <div className="relative z-10 flex max-w-xs flex-col items-center gap-5 px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-lg shadow-brand/25">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink">Your messages</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Choose a conversation from the sidebar, or press{' '}
            <span className="inline-flex items-center gap-1 rounded-md border border-line bg-bg-hover px-1.5 py-0.5 text-xs font-semibold text-ink">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              New
            </span>{' '}
            to start chatting.
          </p>
        </div>
      </div>
    </section>
  )
}
