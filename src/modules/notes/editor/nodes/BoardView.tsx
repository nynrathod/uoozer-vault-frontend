import { useEffect, useState } from 'react'
import { mergeAttributes, Node as TiptapNode } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Plus, X } from 'lucide-react'

export interface BoardViewGroup {
  id: string
  label: string
  /** Hex dot color (#9AA3B2 / #2563EB / #10B981 in the mock). */
  dot: string
}

export interface BoardViewCard {
  id: string
  groupId: string
  text: string
}

interface BoardData {
  groups: BoardViewGroup[]
  cards: BoardViewCard[]
}

let boardUid = 0
function nextId(prefix: string): string {
  boardUid += 1
  return `${prefix}-${boardUid.toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function readBoard(raw: Record<string, unknown> | undefined | null): BoardData {
  const groups = Array.isArray(raw?.groups)
    ? (raw?.groups as unknown[])
        .filter(
          (item): item is Record<string, unknown> => typeof item === 'object' && item !== null
        )
        .map((item) => ({
          id: String(item.id ?? nextId('grp')),
          label: String(item.label ?? 'Group'),
          dot: /^#[0-9a-fA-F]{3,8}$/.test(String(item.dot)) ? String(item.dot) : '#9AA3B2',
        }))
    : []
  const cards = Array.isArray(raw?.cards)
    ? (raw?.cards as unknown[])
        .filter(
          (item): item is Record<string, unknown> => typeof item === 'object' && item !== null
        )
        .map((item) => ({
          id: String(item.id ?? nextId('card')),
          groupId: String(item.groupId ?? groups[0]?.id ?? ''),
          text: String(item.text ?? ''),
        }))
    : []
  if (groups.length === 0) {
    groups.push(
      { id: 'todo', label: 'To do', dot: '#9AA3B2' },
      { id: 'doing', label: 'Doing', dot: '#2563EB' },
      { id: 'done', label: 'Done', dot: '#10B981' }
    )
  }
  return { groups, cards }
}

function BoardViewComponent({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const data = readBoard(node.attrs as Record<string, unknown>)
  const groups = data.groups
  const cards = data.cards

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  /** Column receiving a new card (ghost input open). */
  const [addingIn, setAddingIn] = useState<string | null>(null)
  const [addDraft, setAddDraft] = useState('')
  const [drag, setDrag] = useState<{
    cardId: string
    from: string
    x: number
    y: number
    text: string
  } | null>(null)

  const commit = (next: BoardData) => updateAttributes({ groups: next.groups, cards: next.cards })

  /* Card text ------------------------------------------------------------- */
  const startEdit = (card: BoardViewCard) => {
    setEditingId(card.id)
    setDraft(card.text)
  }
  const commitEdit = () => {
    if (editingId) {
      commit({
        groups,
        cards: cards.map((card) =>
          card.id === editingId ? { ...card, text: draft.trim() } : card
        ),
      })
    }
    setEditingId(null)
  }

  const addCard = () => {
    const text = addDraft.trim()
    if (!text || !addingIn) {
      setAddingIn(null)
      setAddDraft('')
      return
    }
    commit({ groups, cards: [...cards, { id: nextId('card'), groupId: addingIn, text }] })
    setAddingIn(null)
    setAddDraft('')
  }

  const removeCard = (cardId: string) => {
    commit({ groups, cards: cards.filter((card) => card.id !== cardId) })
  }

  /* Drag between columns --------------------------------------------------- */
  useEffect(() => {
    if (!drag) return
    const onMove = (event: PointerEvent) => {
      setDrag((state) => (state ? { ...state, x: event.clientX, y: event.clientY } : state))
    }
    const onUp = (event: PointerEvent) => {
      const column = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-board-group]')
      const groupId = column?.getAttribute('data-board-group') ?? null
      setDrag((state) => {
        if (state && groupId && groupId !== state.from) {
          commit({
            groups,
            cards: cards.map((card) => (card.id === state.cardId ? { ...card, groupId } : card)),
          })
        }
        return null
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- commit closes over attrs
  }, [drag !== null])

  return (
    <NodeViewWrapper className="note-board" contentEditable={false}>
      <div className="note-board-row">
        {groups.map((group) => {
          const list = cards.filter((card) => card.groupId === group.id)
          return (
            <div key={group.id} data-board-group={group.id} className="note-board-col">
              <div className="note-board-head">
                <i
                  className="note-board-dot"
                  style={{ background: group.dot }}
                  aria-hidden="true"
                />
                <span className="note-board-title">{group.label}</span>
                <span className="note-board-count">{list.length}</span>
              </div>
              <div className="note-board-cards">
                {list.map((card) =>
                  editingId === card.id ? (
                    <input
                      key={card.id}
                      className="note-board-card note-board-input"
                      autoFocus
                      value={draft}
                      aria-label="Card text"
                      onChange={(event) => setDraft(event.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(event) => {
                        event.stopPropagation()
                        if (event.key === 'Enter') commitEdit()
                        if (event.key === 'Escape') setEditingId(null)
                      }}
                    />
                  ) : (
                    <div
                      key={card.id}
                      className={`note-board-card${drag?.cardId === card.id ? 'is-dragging' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => startEdit(card)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') startEdit(card)
                      }}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return
                        const startX = event.clientX
                        const startY = event.clientY
                        let moved = false
                        const onFirstMove = (moveEvent: PointerEvent) => {
                          if (
                            moved ||
                            Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 5
                          )
                            return
                          moved = true
                          cleanupFirst()
                          setDrag({
                            cardId: card.id,
                            from: group.id,
                            x: moveEvent.clientX,
                            y: moveEvent.clientY,
                            text: card.text || 'Untitled',
                          })
                        }
                        const cleanupFirst = () => {
                          window.removeEventListener('pointermove', onFirstMove)
                          window.removeEventListener('pointerup', onFirstUp)
                        }
                        const onFirstUp = () => cleanupFirst()
                        window.addEventListener('pointermove', onFirstMove)
                        window.addEventListener('pointerup', onFirstUp)
                      }}
                    >
                      <span className="note-board-card-text">{card.text || 'Untitled'}</span>
                      <button
                        type="button"
                        className="note-board-card-x"
                        aria-label="Delete card"
                        onClick={(event) => {
                          event.stopPropagation()
                          removeCard(card.id)
                        }}
                      >
                        <X className="h-3 w-3" strokeWidth={1.75} />
                      </button>
                    </div>
                  )
                )}
                {addingIn === group.id ? (
                  <input
                    className="note-board-card note-board-input"
                    autoFocus
                    placeholder="Card text…"
                    value={addDraft}
                    aria-label="New card text"
                    onChange={(event) => setAddDraft(event.target.value)}
                    onBlur={addCard}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                      if (event.key === 'Enter') addCard()
                      if (event.key === 'Escape') {
                        setAddingIn(null)
                        setAddDraft('')
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="note-board-add"
                    onClick={() => {
                      setAddingIn(group.id)
                      setAddDraft('')
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.6} /> Add card
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {groups.length === 0 && (
          <button type="button" className="note-board-add" onClick={() => deleteNode()}>
            Empty board — remove it
          </button>
        )}
      </div>
      {drag && (
        <div
          className="note-board-card is-ghost"
          style={{ left: drag.x + 10, top: drag.y + 12 }}
          aria-hidden="true"
        >
          {drag.text}
        </div>
      )}
    </NodeViewWrapper>
  )
}

export const BoardView = TiptapNode.create({
  name: 'boardView',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      groups: { default: null },
      cards: { default: null },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-board-view]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-board-view': '', class: 'note-board' })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(BoardViewComponent)
  },
})

/** Initial /board payload — the mock's three lists, empty. */
export function boardViewSeed(): BoardData {
  return {
    groups: [
      { id: 'todo', label: 'To do', dot: '#9AA3B2' },
      { id: 'doing', label: 'Doing', dot: '#2563EB' },
      { id: 'done', label: 'Done', dot: '#10B981' },
    ],
    cards: [],
  }
}
