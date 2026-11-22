import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { TextSelection, NodeSelection, AllSelection } from '@tiptap/pm/state'
import type { JSONContent } from '@tiptap/core'
import { createNoteEditorExtensions } from './extensions'
import { insertImageFile } from './commands'
import { sanitizeDocumentContent } from '../utils/document'
import { normalizeLinkHref } from '../utils/linkUrl'

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
        /* Links open on a plain click (Notion), never only via the context
           menu: an anchor click while the caret is collapsed navigates, a
           click that ends a text selection does not. The href is taken
           from the raw ATTRIBUTE and normalized — the DOM's .href property
           resolves scheme-less values against the app origin (the
           "localhost/" prefix bug); the attribute is what the user wrote. */
        handleDOMEvents: {
          click: (view, event) => {
            const target = event.target as Element | null
            const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
            if (!anchor || !view.dom.contains(anchor)) return false
            if (!window.getSelection()?.isCollapsed) return false
            event.preventDefault()
            const href = normalizeLinkHref(anchor.getAttribute('href') ?? '')
            if (href) window.open(href, '_blank', 'noopener,noreferrer')
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

  /* A click OUTSIDE the editor dissolves any module selection (Notion:
     nothing stays highlighted). It converts a NodeSelection (selected
     callout / table / sticky…) or an AllSelection back to a plain caret
     and never steals focus from inputs, menus or pickers. */
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

/** The editable surface: a full-height wrapper + the ProseMirror mount.
 *
 * EMPTY-SPACE SELECTION (Notion's page behaviour): the content column is
 * centered, so the canvas keeps wide empty margins left and right — and
 * clicking them used to do NOTHING (no caret, no selection dissolve).
 * Now a mousedown on the canvas's empty space (outside the editor body
 * and outside every piece of chrome) places the caret at the nearest text
 * position via ProseMirror's own hit-testing, focuses the editor, and as
 * a side effect dissolves any module selection — exactly "click outside
 * = cancel whatever was selected", without ever stealing a click from a
 * button, input, menu or picker. */
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
