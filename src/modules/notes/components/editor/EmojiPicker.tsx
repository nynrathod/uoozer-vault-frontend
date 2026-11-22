import { useEffect, useRef, useState } from 'react'
import { useNoteEditor } from '../../editor/NoteEditorProvider'
import { onUiEvent } from '../../editor/uiEvents'
import { EmojiPopover } from './EmojiPopover'

export function EmojiPicker() {
  const editor = useNoteEditor()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLElement | null>(null)
  const anchorMarkerRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    if (!editor) return
    return onUiEvent((event) => {
      if (event.type !== 'emoji.open') return
      try {
        if (editor.isDestroyed) return
        const coords = editor.view.coordsAtPos(editor.state.selection.from)
        // A zero-size anchor element at the caret gives the popover a rect.
        const marker = document.createElement('span')
        marker.style.cssText = `position:fixed;left:${coords.left}px;top:${coords.bottom}px;width:1px;height:18px;pointer-events:none;`
        document.body.appendChild(marker)
        anchorMarkerRef.current = marker
        anchorRef.current = marker
        setOpen(true)
      } catch {
        // Position unavailable (view gone); skip opening.
      }
    })
  }, [editor])

  useEffect(() => {
    if (open || !anchorMarkerRef.current) return
    // Closed: drop the caret marker.
    anchorMarkerRef.current.remove()
    anchorMarkerRef.current = null
    anchorRef.current = null
  }, [open])

  if (!editor) return null

  return (
    <EmojiPopover
      open={open}
      onClose={() => setOpen(false)}
      anchorEl={anchorRef.current}
      onSelect={(char) => {
        try {
          editor.chain().focus().insertContent(char).run()
        } catch {
          // Editor recreating on note switch; the click is simply dropped.
        }
      }}
    />
  )
}
