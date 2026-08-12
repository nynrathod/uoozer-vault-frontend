import { useState, useCallback, useRef, useEffect } from 'react'
import { UI_CONFIG } from '@lib/constants'

export function useClipboard(feedbackMs: number = UI_CONFIG.COPY_FEEDBACK_MS) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text)
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), feedbackMs)
    },
    [feedbackMs]
  )

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  return { copied, copy }
}
