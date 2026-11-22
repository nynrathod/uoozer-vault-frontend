import { Fragment, useState } from 'react'
import { mergeAttributes, Node, nodeInputRule } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'

export const DIVIDER_VARIANTS = ['line', 'dot', 'dash'] as const
export type DividerVariant = (typeof DIVIDER_VARIANTS)[number]

/** Legacy spellings → the current three variants. */
function normalizeVariant(raw: unknown): DividerVariant {
  if (raw === 'dots' || raw === 'dot') return 'dot'
  if (raw === 'rule' || raw === 'dash') return 'dash'
  return 'line'
}

function DividerView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const variant = normalizeVariant(node.attrs.variant)
  const [open, setOpen] = useState(false)
  /** Clicking the line also makes the divider the selected node — the
      gutter menu, ⌫ delete and copy all act on it right away. */
  const selectNode = () => {
    try {
      const pos = typeof getPos === 'function' ? getPos() : null
      if (typeof pos !== 'number' || editor.isDestroyed) return
      editor.view.dispatch(
        editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos))
      )
    } catch {
      /* stale position mid-render; the picker still opens */
    }
  }
  return (
    <NodeViewWrapper
      className="note-divider-blk"
      data-variant={variant}
      data-open={open ? 'true' : undefined}
    >
      <div
        className={`note-divider-${variant}`}
        contentEditable={false}
        role="button"
        tabIndex={0}
        aria-label={`Divider — ${variant}. Click to change style`}
        title="Click to change the divider style"
        onClick={() => {
          selectNode()
          setOpen((value) => !value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            selectNode()
            setOpen((value) => !value)
          }
        }}
      />
      <div className="note-divider-ctl" contentEditable={false}>
        {DIVIDER_VARIANTS.map((option, index) => (
          <Fragment key={option}>
            {index > 0 && <span aria-hidden="true">·</span>}
            <button
              type="button"
              className={`note-divider-opt${option === variant ? 'is-current' : ''}`}
              title={`Divider: ${option}`}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                updateAttributes({ variant: option })
                setOpen(false)
              }}
            >
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </button>
          </Fragment>
        ))}
      </div>
    </NodeViewWrapper>
  )
}

export const Divider = Node.create({
  name: 'divider',
  group: 'block',
  draggable: true,
  addAttributes() {
    return {
      variant: {
        default: 'line',
        rendered: false,
        parseHTML: (element) => normalizeVariant(element.getAttribute('data-variant')),
      },
    }
  },
  parseHTML() {
    return [
      { tag: 'div[data-divider]' },
      { tag: 'hr', priority: 10 }, // so plain <hr> keeps becoming a divider
    ]
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-divider': '',
        'data-variant': normalizeVariant(node.attrs.variant),
      }),
    ]
  },
  addInputRules() {
    return [
      nodeInputRule({
        // Same pattern StarterKit's HorizontalRule ships with.
        find: /^(?:---|—-|___\s|\*\*\*\s)$/,
        type: this.type,
      }),
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(DividerView)
  },
})
