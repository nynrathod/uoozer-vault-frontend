import { useEffect, useMemo, useRef, useState } from 'react'
import { listSlashCommands } from '../../editor/extensions'
import { useNoteEditor } from '../../editor/NoteEditorProvider'
import { SLASH_CATEGORY_LABEL, type SlashCommand } from '../../editor/registry'
import { SLASH_LIST_HEIGHT, SLASH_MENU_WIDTH } from '../../constants'
import { cn } from '@lib/utils'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface GroupedCommands {
  category: SlashCommand['category']
  label: string
  commands: SlashCommand[]
}

export function SlashMenu() {
  const editor = useNoteEditor()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const slashPos = useRef<number | null>(null)
  const itemRefs = useRef(new Map<number, HTMLButtonElement>())
  const commands = useMemo(() => listSlashCommands(), [])

  // Filter, then group by category preserving registry order.
  const groups = useMemo<GroupedCommands[]>(() => {
    const q = query.trim().toLowerCase()
    const matched = commands.filter((command) => {
      if (!q) return true
      const hay =
        `${command.label} ${command.description} ${command.keywords.join(' ')} ${command.shortcut ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
    const out: GroupedCommands[] = []
    for (const command of matched) {
      const last = out[out.length - 1]
      if (last && last.category === command.category) last.commands.push(command)
      else
        out.push({
          category: command.category,
          label: SLASH_CATEGORY_LABEL[command.category],
          commands: [command],
        })
    }
    return out
  }, [commands, query])

  const flat = useMemo(() => groups.flatMap((group) => group.commands), [groups])

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(0, flat.length - 1)))
  }, [flat.length])

  useEffect(() => {
    itemRefs.current.get(index)?.scrollIntoView({ block: 'nearest' })
  }, [index, open])

  // Track the caret: open when "/" starts a word, follow the typed query.
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
      const listHeight = isMobile ? 320 : SLASH_LIST_HEIGHT
      const left = isMobile
        ? 14
        : Math.max(12, Math.min(coords.left, window.innerWidth - SLASH_MENU_WIDTH - 12))
      const top =
        coords.bottom + 8 + listHeight > window.innerHeight
          ? Math.max(12, coords.top - listHeight - 8)
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
  }, [editor, isMobile])

  // Keyboard navigation while open (capture phase beats the editor).
  useEffect(() => {
    if (!open || !editor) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        event.stopPropagation()
        setIndex((current) => (flat.length === 0 ? 0 : (current + 1) % flat.length))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()
        setIndex((current) => (flat.length === 0 ? 0 : (current - 1 + flat.length) % flat.length))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        const command = flat[index]
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

  const searching = query.trim().length > 0
  const activeCommand = flat[index]

  return (
    <div
      className="note-slash"
      style={{ top: position.top, left: position.left }}
      role="listbox"
      aria-label="Insert a block"
    >
      {flat.length === 0 ? (
        <div className="note-slash-empty">
          <p className="note-slash-empty-title">No blocks match “{query.trim()}”.</p>
          <p className="note-slash-empty-sub">
            Keep typing, or press esc to leave it as plain text.
          </p>
        </div>
      ) : (
        <div className="note-slash-list">
          {groups.map((group) => (
            <div key={group.category}>
              <p className="note-slash-group">{group.label}</p>
              {group.commands.map((command) => {
                const itemIndex = flat.indexOf(command)
                const Icon = command.icon
                return (
                  <button
                    key={command.id}
                    type="button"
                    ref={(node) => {
                      if (node) itemRefs.current.set(itemIndex, node)
                      else itemRefs.current.delete(itemIndex)
                    }}
                    role="option"
                    aria-selected={itemIndex === index}
                    className={cn('note-slash-item', itemIndex === index && 'is-active')}
                    onMouseEnter={() => setIndex(itemIndex)}
                    onClick={() => apply(command)}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 truncate text-left">{command.label}</span>
                    {command.shortcut && (
                      <span className="note-slash-hint">{command.shortcut}</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
      <div className="note-slash-footer">
        <p>↑↓ move · ↵ insert · esc close</p>
        {activeCommand?.hint ? (
          <p className="ml-auto flex items-center gap-1 font-medium text-[hsl(var(--success))]">
            {activeCommand.hint}
          </p>
        ) : (
          searching && (
            <p className="ml-auto tabular-nums">
              {flat.length} of {commands.length}
            </p>
          )
        )}
      </div>
    </div>
  )
}
