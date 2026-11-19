import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import { createNoteEditorExtensions } from './extensions'
import { insertImageFile } from './commands'

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

export function NoteEditorProvider({ noteId, content, onChange, children }: NoteEditorProviderProps) {
  const onChangeRef = useRef(onChange)
  const editorRef = useRef<Editor | null>(null)
  onChangeRef.current = onChange
  const extensions = useMemo(() => createNoteEditorExtensions(), [])

  const editor = useEditor(
    {
      immediatelyRender: true,
      extensions,
      content,
      editorProps: {
        attributes: { class: 'note-prosemirror', spellcheck: 'true' },
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

  return <NoteEditorContext.Provider value={editor}>{children}</NoteEditorContext.Provider>
}

export function NoteEditorSurface() {
  const editor = useNoteEditor()
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
