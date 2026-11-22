import type { NoteRecord } from '../types'
import { compareForDisplay } from './document'

export interface NoteTreeNode {
  note: NoteRecord
  /** Live children in display order, each with their own nested children. */
  children: NoteTreeNode[]
  /** How deep this node sits (root = 0). Feeds the sidebar indent. */
  depth: number
  /** Whether any descendant matches the current search (keeps parents visible). */
  hasMatch?: boolean
}

const MAX_DEPTH = 12 // hard stop: real trees never get near this; guards cycles

/** Roots + full nested subtrees, in display order. */
export function buildNoteTree(notes: NoteRecord[]): NoteTreeNode[] {
  const live = new Map<string, NoteRecord>()
  for (const note of notes) if (!note.trashed) live.set(note.id, note)

  // Depth-limited walk from every root; orphans whose whole ancestry is
  // missing are promoted to roots so no note is ever lost from the UI.
  const childrenOf = new Map<string, NoteRecord[]>()
  const roots: NoteRecord[] = []

  for (const note of live.values()) {
    const parent = note.parentNoteId ? live.get(note.parentNoteId) : undefined
    if (parent && parent.id !== note.id) {
      const list = childrenOf.get(parent.id) ?? []
      list.push(note)
      childrenOf.set(parent.id, list)
    } else {
      roots.push(note)
    }
  }

  const sortList = (list: NoteRecord[]) => list.sort(compareForDisplay)
  sortList(roots)
  for (const list of childrenOf.values()) sortList(list)

  const build = (note: NoteRecord, depth: number): NoteTreeNode => ({
    note,
    depth,
    children:
      depth >= MAX_DEPTH
        ? []
        : (childrenOf.get(note.id) ?? []).map((child) => build(child, depth + 1)),
  })

  return roots.map((note) => build(note, 0))
}

/** Depth-first flatten (pre-order) — for keyboard nav and outline use. */
export function flattenNoteTree(nodes: NoteTreeNode[]): NoteTreeNode[] {
  const out: NoteTreeNode[] = []
  const walk = (list: NoteTreeNode[]) => {
    for (const node of list) {
      out.push(node)
      walk(node.children)
    }
  }
  walk(nodes)
  return out
}

/**
 * Filters a tree by a query. A node survives when IT matches or any
 * descendant matches (parents of hits stay visible, hit rows are forced
 * expanded by the sidebar via hasMatch).
 */
export function filterNoteTree(nodes: NoteTreeNode[], query: string): NoteTreeNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes
  const hit = (note: NoteRecord) =>
    note.title.toLowerCase().includes(q) || note.plainText.toLowerCase().includes(q)

  const walk = (list: NoteTreeNode[]): NoteTreeNode[] => {
    const out: NoteTreeNode[] = []
    for (const node of list) {
      const children = walk(node.children)
      if (hit(node.note) || children.length > 0) {
        out.push({ ...node, children, hasMatch: hit(node.note) || children.length > 0 })
      }
    }
    return out
  }
  return walk(nodes)
}
