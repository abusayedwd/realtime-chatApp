'use client'

import { useCallback, useEffect, useState } from 'react'
import { useGetConversationQuery, useUpdateBackgroundMutation } from '@/store/api/conversationApi'
import { PRESET_STYLE_MAP } from '@/lib/chatPresets'

const CUSTOM_KEY = (id: string) => `chat_custom_bg_${id}`

export type BgType = 'preset' | 'custom'

export interface ChatBg {
  type: BgType
  value: string
}

export const DEFAULT_BG_ID = 'dots'

export const useChatBg = (conversationId: string) => {
  const { data: conversation } = useGetConversationQuery(conversationId)
  const [updateBg] = useUpdateBackgroundMutation()

  // Custom image (base64 or URL) — stored in localStorage, device-only
  const [localCustom, setLocalCustom] = useState<string | null>(null)

  // Load custom from localStorage on mount / conversation change
  useEffect(() => {
    try {
      setLocalCustom(localStorage.getItem(CUSTOM_KEY(conversationId)))
    } catch {
      setLocalCustom(null)
    }
  }, [conversationId])

  // Effective background: local custom > server preset > default
  const serverPresetId = conversation?.background || DEFAULT_BG_ID

  const bg: ChatBg = localCustom
    ? { type: 'custom', value: localCustom }
    : { type: 'preset', value: serverPresetId }

  /** Pick a preset (synced to server for both users) */
  const setPreset = useCallback(
    (presetId: string) => {
      try { localStorage.removeItem(CUSTOM_KEY(conversationId)) } catch { /* noop */ }
      setLocalCustom(null)
      updateBg({ id: conversationId, background: presetId })
    },
    [conversationId, updateBg]
  )

  /** Set a custom image (local-only, not shared with the other user) */
  const setCustom = useCallback(
    (dataUrl: string) => {
      try { localStorage.setItem(CUSTOM_KEY(conversationId), dataUrl) } catch { /* storage full */ }
      setLocalCustom(dataUrl)
    },
    [conversationId]
  )

  /** Reset to default preset */
  const reset = useCallback(() => {
    try { localStorage.removeItem(CUSTOM_KEY(conversationId)) } catch { /* noop */ }
    setLocalCustom(null)
    updateBg({ id: conversationId, background: DEFAULT_BG_ID })
  }, [conversationId, updateBg])

  // CSS style for the chat scroll area
  const bgStyle: React.CSSProperties = (() => {
    if (bg.type === 'custom') {
      return {
        backgroundImage: `url("${bg.value}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    }
    // Look up preset style; fall back to default dots
    return PRESET_STYLE_MAP[bg.value] ?? PRESET_STYLE_MAP[DEFAULT_BG_ID]!
  })()

  return { bg, setPreset, setCustom, reset, bgStyle }
}
