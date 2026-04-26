const ts = () => new Date().toISOString()

export const logger = {
  info: (...args: unknown[]) => console.log(`[INFO]  ${ts()}`, ...args),
  warn: (...args: unknown[]) => console.warn(`[WARN]  ${ts()}`, ...args),
  error: (...args: unknown[]) => console.error(`[ERROR] ${ts()}`, ...args),
  debug: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') console.debug(`[DEBUG] ${ts()}`, ...args)
  },
}
