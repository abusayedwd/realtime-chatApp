import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

export const formatTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export const formatRelative = (iso: string) => {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.round(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  if (diffSec < 7 * 24 * 3600) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('')

export const getSenderId = (sender: string | { _id: string }) =>
  typeof sender === 'string' ? sender : sender._id

export const uniqueById = <T extends { _id: string }>(items: T[]): T[] => {
  const seen = new Set<string>()
  return items.filter((i) => (seen.has(i._id) ? false : (seen.add(i._id), true)))
}
