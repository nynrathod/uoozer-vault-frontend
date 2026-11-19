import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { formatBytes } from '@lib/utils'
import { NOTE_IMAGE_BYTE_LIMIT } from '../constants'
import { noteUiBus } from '../bus'

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
  pickFile('image/*', (file) => insertImageFile(editor, file))
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return ''
  const total = Math.round(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function chooseVideo(editor: Editor) {
  pickFile('video/*', (file) => {
    if (!file.type.startsWith('video/')) {
      noteUiBus.emit({ type: 'notify', tone: 'error', message: 'Choose a video file.' })
      return
    }
    const src = URL.createObjectURL(file)
    const probe = document.createElement('video')
    const insert = (duration: string) => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'mediaVideo',
          attrs: { src, title: file.name, duration, caption: 'plays on this device', vaultFileId: null },
        })
        .run()
    }
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => insert(formatDuration(probe.duration))
    probe.onerror = () => insert('')
    probe.src = src
  })
}

export function chooseFile(editor: Editor) {
  pickFile('*/*', (file) => {
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'fileBlock',
        attrs: { fileName: file.name, sizeLabel: formatBytes(file.size), mime: file.type, vaultFileId: null },
      })
      .run()
  })
}
