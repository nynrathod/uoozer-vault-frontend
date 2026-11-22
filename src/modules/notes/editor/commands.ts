import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { formatBytes } from '@lib/utils'
import { NOTE_IMAGE_BYTE_LIMIT } from '../constants'
import { noteUiBus } from '../bus'
import { stickyBoardSeed } from './nodes/StickyBoard'
import type { DividerVariant } from './nodes/DividerBlock'

export function moveTopLevelBlock(editor: Editor, fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) return
  const nodes: PMNode[] = []
  editor.state.doc.forEach((node) => nodes.push(node))
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= nodes.length || toIndex >= nodes.length) return
  const [moved] = nodes.splice(fromIndex, 1)
  if (!moved) return
  nodes.splice(toIndex, 0, moved)
  try {
    const fragment = editor.state.schema.topNodeType.create(null, nodes).content
    editor.view.dispatch(editor.state.tr.replaceWith(0, editor.state.doc.content.size, fragment))
  } catch {
    noteUiBus.emit({ type: 'notify', tone: 'error', message: 'That block could not be moved.' })
  }
}

/** Adds a paragraph holding a single "/" under the block at `index`. */
export function insertSlashAfter(editor: Editor, index: number) {
  let pos = 0
  let cursor = 0
  editor.state.doc.forEach((node, offset) => {
    if (cursor === index) pos = offset + node.nodeSize
    cursor += 1
  })
  editor
    .chain()
    .focus()
    .insertContentAt(pos, { type: 'paragraph', content: [{ type: 'text', text: '/' }] })
    .run()
}

/* ── File pickers ─────────────────────────────────────────────────────────── */

function pickFile(accept: string, onFile: (file: File) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.onchange = () => {
    const file = input.files?.[0]
    if (file) onFile(file)
  }
  input.click()
}

export function insertImageFile(editor: Editor, file: File) {
  if (!file.type.startsWith('image/')) {
    noteUiBus.emit({ type: 'notify', tone: 'error', message: 'Choose an image file.' })
    return
  }
  if (file.size > NOTE_IMAGE_BYTE_LIMIT) {
    noteUiBus.emit({
      type: 'notify',
      tone: 'error',
      message: 'Images over 1.5 MB are skipped locally. Vault sync can take larger files later.',
    })
    return
  }
  const reader = new FileReader()
  reader.onerror = () => {
    noteUiBus.emit({ type: 'notify', tone: 'error', message: 'That image could not be read.' })
  }
  reader.onload = () => {
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'mediaImage',
        attrs: { src: String(reader.result ?? ''), caption: '', alt: file.name, vaultFileId: null },
      })
      .run()
  }
  reader.readAsDataURL(file)
}

export function chooseImage(editor: Editor) {
  /* Notion's flow: /image inserts the "Add an image" pill and its picker
     opens on top of it — the node view auto-opens when src is empty. */
  editor
    .chain()
    .focus()
    .insertContent({
      type: 'mediaImage',
      attrs: { src: '', caption: '', alt: '', vaultFileId: null },
    })
    .run()
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return ''
  const total = Math.round(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function chooseVideo(editor: Editor) {
  /* Notion's flow: /video inserts the "Add a video" pill and its picker
     opens on top of it. */
  editor
    .chain()
    .focus()
    .insertContent({
      type: 'mediaVideo',
      attrs: { src: '', title: '', duration: '', caption: '', vaultFileId: null },
    })
    .run()
}

export function chooseAudio(editor: Editor) {
  pickFile('audio/*', (file) => {
    if (!file.type.startsWith('audio/')) {
      noteUiBus.emit({ type: 'notify', tone: 'error', message: 'Choose an audio file.' })
      return
    }
    const probe = document.createElement('audio')
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'audioBlock',
          attrs: {
            title: file.name,
            duration: formatDuration(probe.duration),
            src: URL.createObjectURL(file),
            vaultFileId: null,
          },
        })
        .run()
    }
    probe.onerror = () => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'audioBlock',
          attrs: { title: file.name, duration: '', src: '', vaultFileId: null },
        })
        .run()
    }
    probe.src = URL.createObjectURL(file)
  })
}

export function chooseFile(editor: Editor) {
  pickFile('*/*', (file) => {
    const isSmall = file.size <= NOTE_IMAGE_BYTE_LIMIT
    const insert = (href: string | null) => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'fileBlock',
          attrs: {
            fileName: file.name,
            sizeLabel: formatBytes(file.size),
            mime: file.type,
            href,
          },
        })
        .run()
    }
    // Small files ride along as data URLs so Download works offline; larger
    // ones insert as reference-only cards until vault sync exists.
    if (!isSmall) {
      insert(null)
      return
    }
    const reader = new FileReader()
    reader.onerror = () => insert(null)
    reader.onload = () => insert(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  })
}

/* ── Structured block inserts (one per widget) ────────────────────────────── */

export function insertBookmark(editor: Editor) {
  editor
    .chain()
    .focus()
    .insertContent({ type: 'bookmark', attrs: { url: '', title: '' } })
    .run()
}

export function insertCallout(editor: Editor, tone: 'secure' | 'success' | 'warning' = 'secure') {
  editor
    .chain()
    .focus()
    .insertContent({
      type: 'callout',
      attrs: { tone },
      content: [{ type: 'paragraph' }],
    })
    .run()
}

export function insertSecret(editor: Editor) {
  editor
    .chain()
    .focus()
    .insertContent({
      type: 'secret',
      attrs: { text: '', revealed: false },
    })
    .run()
}

export function insertSticky(editor: Editor) {
  editor
    .chain()
    .focus()
    .insertContent({
      type: 'sticky',
      attrs: { text: '', color: 'yellow' },
    })
    .run()
}

export function insertStickyBoard(editor: Editor) {
  const seed = stickyBoardSeed()
  editor
    .chain()
    .focus()
    .insertContent({
      type: 'stickyBoard',
      attrs: { items: seed.items, clusters: seed.clusters },
    })
    .run()
}

export function insertAskAi(editor: Editor) {
  editor.chain().focus().insertContent({ type: 'askAi' }).run()
}

export function insertEmbed(editor: Editor) {
  editor
    .chain()
    .focus()
    .insertContent({ type: 'embed', attrs: { url: '', allowed: 'never' } })
    .run()
}

export function insertEquation(editor: Editor) {
  /* Notion's flow: /Equation inserts an EMPTY block; its node view opens
     the minimal editor immediately (EquationView auto-opens when the
     formula is empty) — one gesture from / to a typed formula. */
  editor
    .chain()
    .focus()
    .insertContent({ type: 'equation', attrs: { formula: '' } })
    .run()
}

export function insertDivider(editor: Editor, variant: DividerVariant = 'line') {
  editor.chain().focus().insertContent({ type: 'divider', attrs: { variant } }).run()
}

/** Inserts the Link-to-note card (Blocks-2) with a one-line excerpt. */
export function insertNoteLink(editor: Editor, label: string, noteId: string | null, excerpt = '') {
  editor
    .chain()
    .focus()
    .insertContent({ type: 'noteLink', attrs: { label, noteId, excerpt: excerpt.slice(0, 140) } })
    .run()
}

export function insertChildPage(editor: Editor, label = 'Untitled page') {
  editor
    .chain()
    .focus()
    .insertContent({ type: 'childPage', attrs: { label, noteId: null } })
    .run()
}

export function insertTableOfContents(editor: Editor) {
  editor.chain().focus().insertContent({ type: 'tableOfContents' }).run()
}
