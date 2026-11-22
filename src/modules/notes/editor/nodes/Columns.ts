import { Node, mergeAttributes } from '@tiptap/core'
import {
  columnsChildCountFromElement,
  columnsNodeView,
  equalWidths,
  parseWidthsAttribute,
} from './ColumnsView'

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
      widths: {
        default: null,
        parseHTML: (element) =>
          parseWidthsAttribute(element.getAttribute('data-widths')) ??
          equalWidths(columnsChildCountFromElement(element)),
        renderHTML: (attributes) => {
          const widths = attributes.widths
          return Array.isArray(widths) ? { 'data-widths': widths.join(',') } : {}
        },
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

  addNodeView() {
    return columnsNodeView()
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

/** Builds the insertContent payload for an N-column layout (equal widths). */
export function columnsContent(count: number): {
  type: 'columns'
  attrs: { count: number; widths: number[] }
  content: { type: 'column'; content: { type: 'paragraph' }[] }[]
} {
  return {
    type: 'columns',
    attrs: { count, widths: equalWidths(count) },
    content: Array.from({ length: count }, () => ({
      type: 'column',
      content: [{ type: 'paragraph' }],
    })),
  }
}
