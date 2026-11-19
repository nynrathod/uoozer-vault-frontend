import { Node, mergeAttributes } from '@tiptap/core'

export interface ColumnsOptions {
  HTMLAttributes: Record<string, unknown>
}

export const Columns = Node.create<ColumnsOptions>({
  name: 'columns',
  group: 'block',
  content: 'column+',
  defining: true,

  addOptions() {
    return { HTMLAttributes: {} }
  },

  addAttributes() {
    return {
      count: {
        default: 2,
        parseHTML: (element) => {
          const parsed = Number(element.getAttribute('data-count'))
          return parsed >= 2 && parsed <= 5 ? parsed : 2
        },
        renderHTML: (attributes) => ({ 'data-count': String(Number(attributes.count) || 2) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="columns"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'columns',
        class: 'note-columns',
      }),
      0,
    ]
  },
})

export const Column = Node.create<ColumnsOptions>({
  name: 'column',
  content: 'block+',
  defining: true,

  addOptions() {
    return { HTMLAttributes: {} }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'column',
        class: 'note-column',
      }),
      0,
    ]
  },
})

/** Builds the insertContent payload for an N-column layout. */
export function columnsContent(count: number): {
  type: 'columns'
  attrs: { count: number }
  content: { type: 'column'; content: { type: 'paragraph' }[] }[]
} {
  return {
    type: 'columns',
    attrs: { count },
    content: Array.from({ length: count }, () => ({
      type: 'column',
      content: [{ type: 'paragraph' }],
    })),
  }
}
