import { useState, useEffect, useCallback, useRef } from 'react'
import { UI_CONFIG } from '@lib/constants'

/** Manages inline rename state with debounced save and cancellation support. */
export function useInlineRename(
  currentName: string,
  onSave: (newName: string) => void,
  onCancel: () => void,
  saveDelay: number = UI_CONFIG.RENAME_SAVE_DELAY_MS
) {
  const [name, setName] = useState(currentName)
  const [isSaving, setIsSaving] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setName(currentName)
  }, [currentName])

  const handleSubmit = useCallback(() => {
    if (name.trim() === currentName || isSaving) {
      onCancel()
      return
    }
    setIsSaving(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onSave(name)
      setIsSaving(false)
    }, saveDelay)
  }, [name, currentName, isSaving, onSave, onCancel, saveDelay])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  return { name, setName, isSaving, handleSubmit }
}
