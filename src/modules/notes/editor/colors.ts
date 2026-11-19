import { Mark, mergeAttributes } from '@tiptap/core'

/**
 * The note color system. Names are the single source of truth shared by the
 * editor marks and the selection bubble palette; the actual light/dark values
 * live in index.css (`--note-fg-*` / `--note-bg-*` tokens) so the themes stay
 * in charge of contrast.
 */

export interface NoteShade {
  name: string
  label: string
}

export const NOTE_SHADES: NoteShade[] = [
  { name: 'gray', label: 'Gray' },
  { name: 'brown', label: 'Brown' },
  { name: 'orange', label: 'Orange' },
  { name: 'yellow', label: 'Yellow' },
  { name: 'green', label: 'Green' },
  { name: 'blue', label: 'Blue' },
  { name: 'purple', label: 'Purple' },
  { name: 'pink', label: 'Pink' },
  { name: 'red', label: 'Red' },
]

export function shadeLabel(name: string | null | undefined): string {
  return NOTE_SHADES.find((shade) => shade.name === name)?.label ?? 'Default'
}

/**
 * Builds a theme-aware shade mark: the stored attribute is the shade NAME,
 * rendering is a class + data attribute, and index.css maps the class to the
 * right value per theme. Passing null to the setter clears the mark.
 */
function createShadeMark(markName: string, className: string, dataAttr: string) {
  return Mark.create({
    name: markName,
    addAttributes() {
      return {
        shade: {
          default: null,
          parseHTML: (element) => element.getAttribute(dataAttr),
          renderHTML: (attributes) =>
            attributes.shade
              ? { [dataAttr]: String(attributes.shade), class: `${className}-${attributes.shade}` }
              : {},
        },
      }
    },
    parseHTML() {
      return [{ tag: `span[${dataAttr}]` }]
    },
    renderHTML({ HTMLAttributes }) {
      return ['span', mergeAttributes(HTMLAttributes), 0]
    },
    addCommands() {
      return {
        [`set${markName.charAt(0).toUpperCase()}${markName.slice(1)}`]:
          (shade: string | null) =>
          ({ commands }) =>
            shade === null ? commands.unsetMark(markName) : commands.setMark(markName, { shade }),
      }
    },
  })
}

/** Inline text color, e.g. editor.chain().focus().setNoteTextColor('blue').run() */
export const NoteTextColor = createShadeMark('noteTextColor', 'note-c', 'data-note-color')

/** Inline text background (highlight), e.g. editor.chain().focus().setNoteTextBg('yellow').run() */
export const NoteTextBg = createShadeMark('noteTextBg', 'note-bg', 'data-note-bg')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteShades: {
      setNoteTextColor: (shade: string | null) => ReturnType
      setNoteTextBg: (shade: string | null) => ReturnType
    }
  }
}
