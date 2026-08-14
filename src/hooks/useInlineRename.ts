import { useState, useEffect, useCallback, useRef } from 'react'
import { UI_CONFIG } from '@lib/constants'

/** Manages inline rename state with debounced save, async validation, and error handling. */
export function useInlineRename(
  currentName: string,
  onSave: (newName: string) => Promise<void>,
  onCancel: () => void,
  saveDelay: number = UI_CONFIG.RENAME_SAVE_DELAY_MS,
  isNew: boolean = false
) {
  const [name, setName] = useState(currentName)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setName(currentName)
    setError(null)
  }, [currentName])

  const handleSubmit = useCallback(() => {
    if (isSaving) return

    if (!name.trim()) {
      setError('Name cannot be empty')
      return
    }

    if (!isNew && name.trim() === currentName) {
      onCancel()
      return
    }

    setError(null)
    setIsSaving(true)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        await onSave(name.trim())
        setIsSaving(false)
        onCancel()
      } catch (err: any) {
        setError(err.message || 'Failed to save')
        setIsSaving(false)
      }
    }, saveDelay)
  }, [name, currentName, isSaving, onSave, onCancel, saveDelay, isNew])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  return { name, setName, isSaving, error, handleSubmit }
}
