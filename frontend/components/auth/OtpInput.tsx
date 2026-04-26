'use client'

import { KeyboardEvent, ClipboardEvent, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface OtpInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  autoFocus?: boolean
  error?: boolean
}

export const OtpInput = ({
  length = 6,
  value,
  onChange,
  disabled,
  autoFocus = true,
  error,
}: OtpInputProps) => {
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length }, (_, i) => value[i] ?? '')
  )
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    setDigits(Array.from({ length }, (_, i) => value[i] ?? ''))
  }, [value, length])

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus()
  }, [autoFocus])

  const emit = (arr: string[]) => onChange(arr.join(''))

  const handleChange = (index: number, raw: string) => {
    const char = raw.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = char
    setDigits(next)
    emit(next)
    if (char && index < length - 1) refs.current[index + 1]?.focus()
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits]
        next[index] = ''
        setDigits(next)
        emit(next)
      } else if (index > 0) {
        refs.current[index - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      refs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    const next = Array.from({ length }, (_, i) => pasted[i] ?? '')
    setDigits(next)
    emit(next)
    const focusIdx = Math.min(pasted.length, length - 1)
    refs.current[focusIdx]?.focus()
  }

  return (
    <div className="flex items-center justify-center gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={cn(
            'h-14 w-12 rounded-lg border bg-bg-input text-center text-2xl font-semibold text-ink outline-none transition',
            error
              ? 'border-red-500/60 focus:ring-2 focus:ring-red-500/40'
              : 'border-line focus:border-brand focus:ring-2 focus:ring-brand/40',
            disabled && 'opacity-60'
          )}
        />
      ))}
    </div>
  )
}
