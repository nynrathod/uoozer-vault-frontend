import { useEffect, useMemo, useState } from 'react'
import type { JSONContent } from '@tiptap/core'
import type { NoteRecord } from '../types'
import { useNotesStore } from '../store/notesStore'
import { headingsFromDoc } from './document'

export interface NoteSearchHit {
  noteId: string
  title: string
  /** Where the strongest match came from — drives the result badge. */
  matchedIn: 'title' | 'heading' | 'content'
  /** First matching line, trimmed around the match (⌘K-style preview). */
  snippet: string
  /** Higher sorts first: title 3, heading 2, content 1 (+ token coverage). */
  score: number
}

/** Flattens a document JSON into text lines (one line per text node). */
function docLines(json: JSONContent): string[] {
  const out: string[] = []
  const walk = (node: JSONContent | undefined) => {
    if (!node) return
    const kids = node.content
    if (Array.isArray(kids)) {
      if (typeof node.text === 'string') out.push(node.text)
      for (const child of kids) walk(child)
      return
    }
    if (typeof node.text === 'string') out.push(node.text)
  }
  walk(json)
  return out
}

/** Cuts `line` down to a ~96-char snippet centred on the first match. */
function snippetAround(line: string, lowerLine: string, token: string): string {
  const at = lowerLine.indexOf(token)
  if (at === -1) return line.slice(0, 96)
  const start = Math.max(0, at - 40)
  const end = Math.min(line.length, at + token.length + 56)
  return `${start > 0 ? '…' : ''}${line.slice(start, end).trim()}${end < line.length ? '…' : ''}`
}

/**
 * Searches notes by title, headings and BODY CONTENT. `notes` is the
 * store's list (pass `useNotesStore.getState().notes`); trashed notes are
 * skipped unless `includeTrashed`.
 */
export function searchNotes(
  query: string,
  notes: NoteRecord[],
  opts?: { includeTrashed?: boolean; limit?: number }
): NoteSearchHit[] {
  const raw = query.trim()
  if (!raw) return []
  const tokens = raw.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []
  const limit = opts?.limit ?? 20
  const hits: NoteSearchHit[] = []

  for (const note of notes) {
    if (note.trashed && !opts?.includeTrashed) continue
    const titleLower = note.title.toLowerCase()
    const bodyLines = docLines(note.content)
    const plainLower = note.plainText.toLowerCase()
    const headingTexts = bodyLines.length
      ? headingsFromDoc(note.content).map((heading) => heading.text)
      : []
    const headingLower = headingTexts.map((heading) => heading.toLowerCase())

    // Every token must land somewhere (AND), else the note is out.
    let inTitle = 0
    let inHeading = 0
    let inBody = 0
    let firstToken = tokens[0]
    let snippetLine: string | null = null
    let matchedIn: NoteSearchHit['matchedIn'] = 'content'

    for (const token of tokens) {
      if (titleLower.includes(token)) inTitle += 1
      const headingLine = headingLower.findIndex((heading) => heading.includes(token))
      if (headingLine !== -1) {
        inHeading += 1
        if (snippetLine === null) {
          snippetLine = headingTexts[headingLine]
          matchedIn = 'heading'
          firstToken = token
        }
      }
      if (plainLower.includes(token)) inBody += 1
    }
    if (inTitle + inHeading + inBody < tokens.length) continue

    if (snippetLine === null && inTitle > 0) {
      matchedIn = 'title'
      // Fall through to a body snippet when the body also matches.
    }
    if (snippetLine === null) {
      const lowerLines = bodyLines.map((line) => line.toLowerCase())
      for (const token of tokens) {
        const at = lowerLines.findIndex((line) => line.includes(token) && line.trim().length > 0)
        if (at !== -1) {
          snippetLine = bodyLines[at]
          matchedIn = 'content'
          firstToken = token
          break
        }
      }
    }

    const titleHit = tokens.every((token) => titleLower.includes(token))
    const score =
      (titleHit ? 3 : inTitle > 0 ? 2 : 0) + (inHeading > 0 ? 2 : 0) + (inBody > 0 ? 1 : 0)

    const snippet =
      snippetLine !== null
        ? snippetAround(snippetLine, snippetLine.toLowerCase(), firstToken)
        : note.plainText.slice(0, 96)

    hits.push({
      noteId: note.id,
      title: note.title || 'Untitled',
      matchedIn,
      snippet,
      score,
    })
  }

  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, limit)
}

/** A note is "about" the query when its title or content mentions it. */
export function noteMatchesQuery(note: NoteRecord, query: string): boolean {
  const raw = query.trim().toLowerCase()
  if (!raw) return true
  return searchNotes(raw, [note], { includeTrashed: true }).length > 0
}

/* ── Optional React hook for the shell ⌘K dialog ──────────────────────────
   Debounced (120 ms), store-fed: results update as notes are edited. */

export function useNoteSearch(
  query: string,
  opts?: { includeTrashed?: boolean; limit?: number }
): NoteSearchHit[] {
  const notes = useNotesStore((state) => state.notes)
  const [debounced, setDebounced] = useState(query)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 120)
    return () => window.clearTimeout(timer)
  }, [query])
  return useMemo(
    () => searchNotes(debounced, notes, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- opts is a literal per call site
    [debounced, notes, opts?.includeTrashed, opts?.limit]
  )
}
