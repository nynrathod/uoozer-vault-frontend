import type { JSONContent } from '@tiptap/core'
import { plainTextFromDoc } from '../document'
import type { NoteRecord } from '../types'

const sketch = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><rect width="640" height="360" fill="#dbeafe"/><circle cx="470" cy="88" r="34" fill="#fff"/><path d="M0 210C140 170 220 250 340 214 470 176 530 230 640 188V360H0Z" fill="#93c5fd"/><path d="M0 250C150 214 250 292 400 250 520 218 560 270 640 236V360H0Z" fill="#60a5fa"/><path d="M0 300C180 268 320 330 640 276V360H0Z" fill="#3b82f6"/></svg>`
)}`

function text(value: string, marks?: JSONContent['marks']): JSONContent {
  return marks ? { type: 'text', text: value, marks } : { type: 'text', text: value }
}

function paragraph(content: JSONContent[]): JSONContent {
  return { type: 'paragraph', content }
}

function note(
  partial: Pick<
    NoteRecord,
    'id' | 'title' | 'tags' | 'order' | 'starred' | 'pinned' | 'trashed' | 'updatedAt'
  > & {
    content: JSONContent
  }
): NoteRecord {
  return {
    folderId: null,
    createdAt: partial.updatedAt,
    revision: 1,
    sealed: null,
    plainText: plainTextFromDoc(partial.content),
    ...partial,
  }
}

function projectIdeas(): JSONContent {
  return {
    type: 'doc',
    content: [
      paragraph([
        text('End-to-end encrypted notes for '),
        text('all your sensitive thoughts', [{ type: 'highlight', attrs: { color: '#dbe7ff' } }]),
        text(', built so that nobody but you can ever read them.'),
      ]),
      { type: 'heading', attrs: { level: 2 }, content: [text('Roadmap')] },
      {
        type: 'taskList',
        content: [
          task('Zero-knowledge share links', true),
          task('Offline-first sync with safe merge', false),
          task('Encrypted attachments', false),
        ],
      },
      {
        type: 'mediaImage',
        attrs: {
          src: sketch,
          caption: 'Key flow sketch',
          alt: 'Key flow sketch',
          vaultFileId: null,
        },
      },
      {
        type: 'mediaVideo',
        attrs: {
          src: '',
          title: 'Walkthrough.mp4',
          duration: '2:14',
          caption: 'decrypts on play',
          vaultFileId: null,
        },
      },
      {
        type: 'codeBlock',
        attrs: { language: 'typescript' },
        content: [
          text(
            'const key = await deriveKey(passphrase) // Argon2id\nconst sealed = encrypt(note, key)'
          ),
        ],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [header('Feature'), header('Status'), header('Area')],
          },
          {
            type: 'tableRow',
            content: [cell('Share links'), pill('In progress', 'progress'), cell('Backend')],
          },
          {
            type: 'tableRow',
            content: [cell('Offline sync'), pill('Planned', 'planned'), cell('Client')],
          },
          {
            type: 'tableRow',
            content: [cell('Attachments'), pill('Planned', 'planned'), cell('Storage')],
          },
        ],
      },
      {
        type: 'callout',
        attrs: { tone: 'secure' },
        content: [
          paragraph([
            text('Keys never leave your devices. Everything here is encrypted before it syncs.'),
          ]),
        ],
      },
      {
        type: 'blockquote',
        content: [paragraph([text('Typing should never wait on the network.')])],
      },
    ],
  }
}

function task(label: string, checked: boolean): JSONContent {
  return {
    type: 'taskItem',
    attrs: { checked },
    content: [paragraph([text(label)])],
  }
}

function header(label: string): JSONContent {
  return { type: 'tableHeader', content: [paragraph([text(label)])] }
}

function cell(label: string): JSONContent {
  return { type: 'tableCell', content: [paragraph([text(label)])] }
}

function pill(label: string, tone: string): JSONContent {
  return {
    type: 'tableCell',
    content: [paragraph([{ type: 'statusPill', attrs: { label, tone } }])],
  }
}

function short(copy: string): JSONContent {
  return { type: 'doc', content: [paragraph([text(copy)])] }
}

/**
 * Sample workspace used the first time this browser has no saved notes.
 * `order` mirrors the reference layout: pinned first, then the notes list.
 */
export function seedNotes(now = new Date()): NoteRecord[] {
  const iso = now.toISOString()
  return [
    note({
      id: 'note-meeting',
      title: 'Meeting Notes',
      tags: ['work'],
      order: 0,
      starred: true,
      pinned: true,
      trashed: false,
      updatedAt: new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString(),
      content: short(
        'Q3 planning session with the team. Decisions stay on this device until sync exists.'
      ),
    }),
    note({
      id: 'note-project-ideas',
      title: 'Project Ideas',
      tags: ['ideas', 'product'],
      order: 10,
      starred: false,
      pinned: false,
      trashed: false,
      updatedAt: iso,
      content: projectIdeas(),
    }),
    note({
      id: 'note-reading',
      title: 'Reading list',
      tags: ['ideas'],
      order: 20,
      starred: false,
      pinned: false,
      trashed: false,
      updatedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 40).toISOString(),
      content: short('Papers on authenticated encryption, local-first merge, and editor history.'),
    }),
    note({
      id: 'note-weekly',
      title: 'Weekly review',
      tags: ['work'],
      order: 30,
      starred: false,
      pinned: false,
      trashed: false,
      updatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      content: short(
        'What shipped, what slipped, and what should move into the vault notes backend.'
      ),
    }),
    note({
      id: 'note-interview',
      title: 'Interview prep',
      tags: ['learning'],
      order: 40,
      starred: false,
      pinned: false,
      trashed: false,
      updatedAt: '2026-11-02T15:00:00.000Z',
      content: short(
        'System design questions and answers for sync, conflict handling, and key storage.'
      ),
    }),
    note({
      id: 'note-discarded',
      title: 'Discarded sketch',
      tags: [],
      order: 50,
      starred: false,
      pinned: false,
      trashed: true,
      updatedAt: '2026-10-28T12:00:00.000Z',
      content: short('An older outline kept in trash so restore and delete can be tried locally.'),
    }),
  ]
}
