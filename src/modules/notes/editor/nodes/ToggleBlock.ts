import { Node, mergeAttributes, type Editor } from '@tiptap/core'

export interface ToggleOptions {
  HTMLAttributes: Record<string, unknown>
}

const CHEVRON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>'

export const ToggleBlock = Node.create<ToggleOptions>({
  name: 'toggleBlock',
  group: 'block',
  content: 'paragraph block*',
  defining: true,

  addOptions() {
    return { HTMLAttributes: {} }
  },

  addAttributes() {
    return {
      open: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-open') === 'true',
        renderHTML: (attributes) => ({ 'data-open': String(Boolean(attributes.open)) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toggle-block"]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'toggle-block',
        'data-open': String(Boolean(node.attrs.open)),
        class: 'note-toggle',
      }),
      0,
    ]
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      let current = node

      const dom = document.createElement('div')
      dom.className = 'note-toggle'
      dom.dataset.open = String(Boolean(current.attrs.open))

      const content = document.createElement('div')
      content.className = 'note-toggle-content'

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'note-toggle-btn'
      button.setAttribute('aria-label', 'Toggle section')
      button.title = 'Toggle'
      button.innerHTML = CHEVRON_SVG

      const flip = () => {
        try {
          if (editor.isDestroyed) return
          const pos = getPos()
          if (typeof pos !== 'number') return
          editor.view.dispatch(
            editor.state.tr.setNodeMarkup(pos, undefined, { open: dom.dataset.open !== 'true' })
          )
        } catch {
          // The node vanished mid-click (undo, note switch); nothing to do.
        }
      }
      const stopPress = (event: MouseEvent) => event.preventDefault()
      button.addEventListener('mousedown', stopPress)
      button.addEventListener('click', flip)

      // Enter on a closed toggle opens it so the new paragraph is visible.
      const onEnter = (event: KeyboardEvent) => {
        if (event.key !== 'Enter') return
        if (dom.dataset.open !== 'false') return
        try {
          if (editor.isDestroyed) return
          const pos = getPos()
          if (typeof pos !== 'number') return
          editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { open: true }))
        } catch {
          // Ignore: the keypress still creates the paragraph, just hidden.
        }
      }
      content.addEventListener('keydown', onEnter)

      dom.append(content, button)

      return {
        dom,
        contentDOM: content,
        update(updatedNode) {
          if (updatedNode.type.name !== 'toggleBlock') return false
          current = updatedNode
          dom.dataset.open = String(Boolean(current.attrs.open))
          return true
        },
        destroy() {
          button.removeEventListener('mousedown', stopPress)
          button.removeEventListener('click', flip)
          content.removeEventListener('keydown', onEnter)
        },
      }
    }
  },
})

/** Slash-menu helper: inserts a toggle and keeps the caret in its summary line. */
export function insertToggleBlock(editor: Editor): void {
  try {
    editor
      .chain()
      .focus()
      .insertContent({ type: 'toggleBlock', content: [{ type: 'paragraph' }] })
      .run()
  } catch {
    // Editor recreating on note switch — nothing to insert into.
  }
}
