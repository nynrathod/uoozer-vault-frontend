import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { TextSelection, NodeSelection, AllSelection } from '@tiptap/pm/state'
import type { JSONContent } from '@tiptap/core'
import { createNoteEditorExtensions } from './extensions'
import { insertImageFile } from './commands'
import { sanitizeDocumentContent } from '../utils/document'

const NoteEditorContext = createContext<Editor | null>(null)

export function useNoteEditor() {
  return useContext(NoteEditorContext)
}

interface NoteEditorProviderProps {
  noteId: string
  content: JSONContent
  onChange: (noteId: string, content: JSONContent) => void
  children: ReactNode
}

export function NoteEditorProvider({
  noteId,
  content,
  onChange,
  children,
}: NoteEditorProviderProps) {
  const onChangeRef = useRef(onChange)
  const editorRef = useRef<Editor | null>(null)
  onChangeRef.current = onChange
  const extensions = useMemo(() => createNoteEditorExtensions(), [])
  // Stored documents may contain block types the module no longer ships;
  // they are dropped/degraded before the schema ever sees them.
  const safeContent = useMemo(() => sanitizeDocumentContent(content), [content])

  const editor = useEditor(
    {
      immediatelyRender: true,
      extensions,
      content: safeContent,
      editorProps: {
        attributes: { class: 'note-prosemirror', spellcheck: 'true' },

        handleDOMEvents: {
          click: (view, event) => {
            const target = event.target as Element | null
            const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
            if (!anchor || !view.dom.contains(anchor)) return false
            if (!window.getSelection()?.isCollapsed) return false
            event.preventDefault()
            window.open(anchor.href, '_blank', 'noopener,noreferrer')
            return true
          },
        },
        handlePaste: (_view, event) => {
          const file = Array.from(event.clipboardData?.files ?? []).find((item) =>
            item.type.startsWith('image/')
          )
          if (!file || !editorRef.current) return false
          event.preventDefault()
          insertImageFile(editorRef.current, file)
          return true
        },
        handleDrop: (_view, event) => {
          const file = Array.from(event.dataTransfer?.files ?? []).find((item) =>
            item.type.startsWith('image/')
          )
          if (!file || !editorRef.current) return false
          event.preventDefault()
          insertImageFile(editorRef.current, file)
          return true
        },
      },
      onUpdate: ({ editor: current }) => onChangeRef.current(noteId, current.getJSON()),
    },
    [noteId]
  )

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  useEffect(() => {
    if (!editor) return
    const onDocMouseDown = (event: MouseEvent) => {
      if (editor.isDestroyed) return
      const target = event.target as Node
      const viewDom = editor.view.dom
      if (viewDom.contains(target)) return
      const element = target instanceof Element ? target : null
      // Popovers, menus and pickers own their own dismissal logic.
      if (
        element?.closest(
          '.note-pop, .note-table-pop, .note-emoji, .note-slash, .note-bubble, .note-col-menu, .note-col-toolbar, .note-block-menu, .note-bookmark-pop, .note-equation-pop, .trashd'
        )
      )
        return
      const selection = editor.state.selection
      const isNodeSel = selection instanceof NodeSelection
      const isAllSel = selection instanceof AllSelection
      if (!isNodeSel && !isAllSel) return
      try {
        const tr = editor.state.tr
        const pos = isNodeSel ? selection.from : Math.min(1, editor.state.doc.content.size)
        tr.setSelection(TextSelection.near(editor.state.doc.resolve(pos), 1))
        editor.view.dispatch(tr)
      } catch {
        /* document moved under us — nothing to dissolve */
      }
    }
    document.addEventListener('mousedown', onDocMouseDown, true)
    return () => document.removeEventListener('mousedown', onDocMouseDown, true)
  }, [editor])

  return <NoteEditorContext.Provider value={editor}>{children}</NoteEditorContext.Provider>
}

export function NoteEditorSurface() {
  const editor = useNoteEditor()

  useEffect(() => {
    if (!editor) return
    const onCanvasMouseDown = (event: MouseEvent) => {
      if (editor.isDestroyed) return
      const target = event.target as Element | null
      if (!target) return
      const viewDom = editor.view.dom
      if (viewDom.contains(target)) return
      // Only clicks inside the note canvas are ours (margins, paddings);
      // the sidebar, header, dialogs and trash manage themselves.
      const canvas = target.closest('.note-canvas')
      if (!canvas || !canvas.contains(viewDom)) return
      // Interactive chrome owns its own clicks — never move the caret.
      if (
        target.closest(
          'button, input, textarea, select, a, label, [role="button"], [contenteditable="false"], ' +
            '.note-pop, .note-bubble, .note-slash, .note-emoji, .note-table-pop, .note-col-menu, ' +
            '.note-col-toolbar, .note-col-rule, .note-block-menu, .note-bookmark-pop, ' +
            '.note-equation-pop, .note-cover-actions, .note-page-actions, .note-tag-row, ' +
            '.note-media-toolbar, .note-code-head, .note-sticky-dot, .note-ai'
        )
      ) {
        return
      }
      let pos: number | null = null
      try {
        pos = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? null
      } catch {
        pos = null
      }
      event.preventDefault()
      try {
        const tr = editor.state.tr
        const $pos = editor.state.doc.resolve(
          Math.max(0, Math.min(pos ?? 0, editor.state.doc.content.size))
        )
        tr.setSelection(TextSelection.near($pos, 1))
        editor.view.dispatch(tr)
        editor.view.focus()
        return
      } catch {
        /* position not resolvable — fall through to the doc ends */
      }
      editor.commands.focus('end')
    }
    document.addEventListener('mousedown', onCanvasMouseDown, true)
    return () => document.removeEventListener('mousedown', onCanvasMouseDown, true)
  }, [editor])

  return (
    <div
      className="note-surface"
      data-note-surface
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) editor?.commands.focus('end')
      }}
    >
      <EditorContent editor={editor} />
    </div>
  )
}
