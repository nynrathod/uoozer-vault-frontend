import { useEffect, useMemo, useRef, useState } from 'react'
import { Lock, Play } from 'lucide-react'
import { listSlashCommands } from '../editor/extensions'
import type { SlashCommand } from '../editor/registry'
import { useNoteEditor } from '../editor/NoteEditorProvider'

/** Menu body height (px). Keep in sync with .note-slash-list max-height in
 *  index.css — it drives the flip-above-the-caret position math. */
const LIST_H = 380

const LABELS: Record<SlashCommand['category'], string> = {
  ai: 'AI',
  basic: 'Basic',
  media: 'Media',
  advanced: 'Advanced',
}

function SlashPreview({ command }: { command: SlashCommand }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <PreviewArt command={command} />
      <div>
        <p className="text-foreground text-[13px] font-semibold">{command.label}</p>
        <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
          {command.description}
        </p>
      </div>
      {command.hint && (
        <p className="note-preview-hint">
          <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          {command.hint}
        </p>
      )}
    </div>
  )
}

function PreviewArt({ command }: { command: SlashCommand }) {
  const Icon = command.icon
  if (command.id === 'image') {
    return (
      <div>
        <div className="note-preview-image" />
        <p className="note-preview-caption">Add a caption…</p>
      </div>
    )
  }
  if (command.id === 'video') {
    return (
      <div className="note-preview-video">
        <Play className="h-5 w-5 fill-current" />
      </div>
    )
  }
  if (command.id === 'code') {
    return <div className="note-preview-code">const sealed = encrypt(note, key)</div>
  }
  if (command.id === 'file') {
    return (
      <div className="note-preview-file">
        <span className="note-file-icon">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0">
          <span className="text-foreground block truncate text-[13px] font-medium">design.fig</span>
          <span className="text-muted-foreground block truncate text-[12px]">On this device</span>
        </span>
      </div>
    )
  }
  return (
    <div className="note-preview-generic">
      <Icon
        className={
          command.id === 'ask-ai' ? 'text-primary h-6 w-6' : 'text-muted-foreground h-6 w-6'
        }
        strokeWidth={1.75}
      />
    </div>
  )
}

export function SlashMenu() {
  const editor = useNoteEditor()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const slashPos = useRef<number | null>(null)
  const itemRefs = useRef(new Map<number, HTMLButtonElement>())
  const commands = useMemo(() => listSlashCommands(), [])
  const searching = query.trim().length > 0

  // Every registered block is ALWAYS listed — nothing is hidden until you
  // type. Typing just filters the same complete list.
  const shown = useMemo(() => {
    const q = query.toLowerCase()
    return commands.filter((command) => {
      const hay =
        `${command.label} ${command.description} ${command.keywords.join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
  }, [commands, query])

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(0, shown.length - 1)))
  }, [shown.length])

  useEffect(() => {
    itemRefs.current.get(index)?.scrollIntoView({ block: 'nearest' })
  }, [index, open])

  useEffect(() => {
    if (!editor) return
    const sync = () => {
      if (editor.isActive('codeBlock')) {
        setOpen(false)
        return
      }
      const { from } = editor.state.selection
      const before = editor.state.doc.textBetween(Math.max(0, from - 40), from, '\n')
      const match = before.match(/(?:^|\s)\/([^\s/]*)$/)
      if (!match) {
        setOpen(false)
        slashPos.current = null
        return
      }
      const typed = match[1] ?? ''
      slashPos.current = from - typed.length - 1
      setQuery(typed)
      const coords = editor.view.coordsAtPos(from)
      const width = 620
      const left = Math.max(12, Math.min(coords.left, window.innerWidth - width - 12))
      const top =
        coords.bottom + 8 + LIST_H > window.innerHeight
          ? Math.max(12, coords.top - LIST_H - 8)
          : coords.bottom + 8
      setPosition({ top, left })
      setOpen(true)
    }
    editor.on('update', sync)
    editor.on('selectionUpdate', sync)
    return () => {
      editor.off('update', sync)
      editor.off('selectionUpdate', sync)
    }
  }, [editor])

  useEffect(() => {
    if (!open || !editor) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        event.stopPropagation()
        setIndex((current) => (shown.length === 0 ? 0 : (current + 1) % shown.length))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()
        setIndex((current) =>
          shown.length === 0 ? 0 : (current - 1 + shown.length) % shown.length
        )
      } else if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        const command = shown[index]
        if (command) apply(command)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  })

  const apply = (command: SlashCommand) => {
    if (!editor) return
    const from = slashPos.current
    if (from !== null) {
      editor.chain().focus().deleteRange({ from, to: editor.state.selection.from }).run()
    }
    command.run(editor)
    setOpen(false)
    slashPos.current = null
  }

  if (!open) return null

  let lastCategory = ''
  return (
    <div className="note-slash" style={{ top: position.top, left: position.left }}>
      <div className="note-slash-body">
        <div className="note-slash-list">
          {shown.length === 0 && (
            <p className="text-muted-foreground px-3 py-6 text-[13px]">No matching blocks</p>
          )}
          {shown.map((command, itemIndex) => {
            const showLabel = command.category !== lastCategory
            lastCategory = command.category
            const Icon = command.icon
            return (
              <div key={command.id}>
                {showLabel && <p className="note-slash-heading">{LABELS[command.category]}</p>}
                <button
                  type="button"
                  ref={(node) => {
                    if (node) itemRefs.current.set(itemIndex, node)
                    else itemRefs.current.delete(itemIndex)
                  }}
                  className={itemIndex === index ? 'note-slash-item is-active' : 'note-slash-item'}
                  onMouseEnter={() => setIndex(itemIndex)}
                  onClick={() => apply(command)}
                >
                  <span className="note-slash-icon">
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                  <span className="truncate">{command.label}</span>
                  {searching && command.id.startsWith(query.trim().toLowerCase()) && (
                    <span className="note-slash-chip">/{command.id}</span>
                  )}
                </button>
              </div>
            )
          })}
        </div>
        <div className="note-slash-preview">
          <p className="note-slash-heading mb-3">Preview</p>
          {shown[index] ? <SlashPreview command={shown[index]} /> : null}
        </div>
      </div>
      <div className="note-slash-footer">
        <p>↑↓ to navigate · ↵ to insert · esc to close</p>
        <p className="tabular-nums">
          {searching ? `${shown.length} of ${commands.length} blocks` : `${commands.length} blocks`}
        </p>
      </div>
    </div>
  )
}
