import type { JSONContent } from '@tiptap/core'
import { plainTextFromDoc } from '../utils/document'
import { DEFAULT_PAGE_STYLE, type NoteRecord, type NoteTemplate } from '../types'

const sketch = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><rect width="640" height="360" fill="#DCE8FB"/><circle cx="470" cy="88" r="34" fill="#FFFFFF" opacity=".9"/><path d="M0 210C140 170 220 250 340 214 470 176 530 230 640 188V360H0Z" fill="#A9C3F5"/><path d="M0 250C150 214 250 292 400 250 520 218 560 270 640 236V360H0Z" fill="#5B8DEF"/></svg>`
)}`

function text(value: string, marks?: JSONContent['marks']): JSONContent {
  return marks ? { type: 'text', text: value, marks } : { type: 'text', text: value }
}

function paragraph(content: JSONContent[]): JSONContent {
  return { type: 'paragraph', content }
}

function heading(level: number, value: string): JSONContent {
  return { type: 'heading', attrs: { level }, content: [text(value)] }
}

function note(
  partial: Pick<
    NoteRecord,
    'id' | 'title' | 'tags' | 'order' | 'starred' | 'pinned' | 'trashed' | 'updatedAt'
  > & {
    content: JSONContent
    background?: NoteRecord['pageStyle']['background']
    kind?: NoteRecord['pageStyle']['kind']
    cover?: NoteRecord['pageStyle']['cover']
    font?: NoteRecord['pageStyle']['font']
    icon?: NoteRecord['icon']
    parentNoteId?: NoteRecord['parentNoteId']
  }
): NoteRecord {
  return {
    folderId: null,
    parentNoteId: partial.parentNoteId ?? null,
    icon: partial.icon ?? null,
    createdAt: partial.updatedAt,
    revision: 1,
    sealed: null,
    plainText: plainTextFromDoc(partial.content),
    pageStyle: {
      ...DEFAULT_PAGE_STYLE,
      background: partial.background ?? 'default',
      kind: partial.kind ?? 'paper',
      font: partial.font ?? 'sans',
      cover: partial.cover ?? null,
    },
    ...partial,
  }
}

function task(label: string, checked: boolean): JSONContent {
  return {
    type: 'taskItem',
    attrs: { checked },
    content: [paragraph([text(label)])],
  }
}

function short(copy: string): JSONContent {
  return { type: 'doc', content: [paragraph([text(copy)])] }
}

/* ── The demo table — Notion's SIMPLE table as real PM content: a header
   row plus three body rows, the same facts the design sheet showed. ─────── */
function tableCell(value: string): JSONContent {
  return { type: 'tableCell', content: [paragraph([text(value)])] }
}

function tableHeaderCell(value: string): JSONContent {
  return { type: 'tableHeader', content: [paragraph([text(value)])] }
}

function demoTable(): JSONContent {
  return {
    type: 'table',
    content: [
      {
        type: 'tableRow',
        content: [tableHeaderCell('Feature'), tableHeaderCell('Status'), tableHeaderCell('Owner')],
      },
      {
        type: 'tableRow',
        content: [tableCell('Share links'), tableCell('In progress'), tableCell('Nayan')],
      },
      {
        type: 'tableRow',
        content: [tableCell('Offline sync'), tableCell('Planned'), tableCell('—')],
      },
      {
        type: 'tableRow',
        content: [tableCell('Attachments'), tableCell('Done'), tableCell('Nayan')],
      },
    ],
  }
}

/* ── Board seed (Blocks-2 "Board view", same cards) ─────────────────────── */
/* ── DEMO PAGE 1 · Project Ideas — every WRITING block (Blocks-1) ────────── */
function projectIdeas(): JSONContent {
  return {
    type: 'doc',
    content: [
      paragraph([
        text('End-to-end encrypted notes for '),
        text('all your sensitive thoughts', [{ type: 'highlight', attrs: { color: '#dbe7ff' } }]),
        text(
          ', built so that nobody but you can ever read them. Select any text to get the floating toolbar — '
        ),
        text('bold', [{ type: 'bold' }]),
        text(', '),
        text('italic', [{ type: 'italic' }]),
        text(', '),
        text('strike', [{ type: 'strike' }]),
        text(', '),
        text('code', [{ type: 'code' }]),
        text(', '),
        text('a link', [
          {
            type: 'link',
            attrs: {
              href: 'https://example.com',
              target: '_blank',
              rel: 'noopener noreferrer nofollow',
              class: 'note-link',
            },
          },
        ]),
        text(' and '),
        text('highlight', [{ type: 'highlight', attrs: { color: '#fde68a' } }]),
        text('.'),
      ]),
      { type: 'tableOfContents' },
      heading(2, 'Roadmap'),
      {
        type: 'taskList',
        content: [
          task('Write the spec', true),
          task('Review the crypto', true),
          task('Ship the alpha', false),
        ],
      },
      heading(2, 'Principles'),
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [paragraph([text('Zero-knowledge links')])] },
          {
            type: 'listItem',
            content: [
              paragraph([text('Offline sync')]),
              {
                type: 'bulletList',
                content: [{ type: 'listItem', content: [paragraph([text('Safe merge')])] }],
              },
            ],
          },
        ],
      },
      {
        type: 'orderedList',
        content: [
          { type: 'listItem', content: [paragraph([text('Write it')])] },
          { type: 'listItem', content: [paragraph([text('Seal it')])] },
          { type: 'listItem', content: [paragraph([text('Share it')])] },
        ],
      },
      {
        type: 'toggleBlock',
        attrs: { open: false },
        content: [
          paragraph([text('Open questions')]),
          paragraph([text('How do share links expire? Who can revoke them?')]),
        ],
      },
      {
        type: 'blockquote',
        content: [paragraph([text('Typing should never wait on the network.')])],
      },
      {
        type: 'callout',
        attrs: { tone: 'secure' },
        content: [paragraph([text('Keys never leave this device.')])],
      },
      {
        type: 'callout',
        attrs: { tone: 'success' },
        content: [paragraph([text('Backup verified.')])],
      },
      {
        type: 'callout',
        attrs: { tone: 'warning' },
        content: [paragraph([text('Share links expire in 7 days.')])],
      },
      { type: 'divider', attrs: { variant: 'line' } },
      { type: 'divider', attrs: { variant: 'dot' } },
      { type: 'divider', attrs: { variant: 'dash' } },
      heading(2, 'Key derivation'),
      {
        type: 'codeBlock',
        attrs: { language: 'typescript' },
        content: [
          text('const key = derive(pass)\nconst sealed = seal(note, key)\nawait vault.put(sealed)'),
        ],
      },
      { type: 'equation', attrs: { formula: 'a² + b² = c²' } },
      { type: 'equation', attrs: { formula: 'E = mc²' } },
      heading(2, 'Pros and cons'),
      {
        type: 'columns',
        attrs: { count: 2, widths: [50, 50] },
        content: [
          {
            type: 'column',
            content: [
              heading(3, 'Pros'),
              paragraph([text('Fast, private, simple — the whole model fits in one sentence.')]),
            ],
          },
          {
            type: 'column',
            content: [
              heading(3, 'Cons'),
              paragraph([text('No server search. Key recovery is on you.')]),
            ],
          },
        ],
      },
      heading(2, 'Delivery board'),
      {
        type: 'callout',
        attrs: { tone: 'info' },
        content: [
          paragraph([text('The kanban board view was removed — this wall keeps its cards.')]),
        ],
      },
      heading(2, 'The grid'),
      demoTable(),
      heading(2, 'Media'),
      {
        type: 'mediaImage',
        attrs: {
          src: sketch,
          caption: 'Key flow sketch',
          alt: 'Key flow sketch',
          align: 'left',
          vaultFileId: null,
        },
      },
      {
        type: 'mediaVideo',
        attrs: { src: '', title: '', duration: '', caption: '', vaultFileId: null },
      },
      {
        type: 'fileBlock',
        attrs: {
          fileName: 'contract.pdf',
          sizeLabel: '2.4 MB',
          mime: 'application/pdf',
          vaultFileId: null,
        },
      },
      heading(2, 'Links'),
      {
        type: 'bookmark',
        attrs: {
          url: 'https://example.com/zero-knowledge-sync',
          title: 'How zero-knowledge sync works',
          description: 'A plain-language tour of keys, devices and what a server can never see.',
        },
      },
      {
        type: 'embed',
        attrs: { url: 'https://en.wikipedia.org/wiki/Zero-knowledge_proof', allowed: 'never' },
      },
      {
        type: 'noteLink',
        attrs: {
          noteId: 'note-meeting',
          label: 'Meeting Notes',
          excerpt: 'Q3 planning session with the team…',
        },
      },
      { type: 'childPage', attrs: { label: 'Meeting notes', noteId: 'note-meeting-child' } },
      heading(2, 'Widgets'),
      { type: 'sticky', attrs: { text: 'Call about the key backup', color: 'yellow' } },
      { type: 'sticky', attrs: { text: 'Try the safe mode', color: 'pink' } },
      { type: 'secret', attrs: { text: 'correct horse battery', revealed: false } },
      { type: 'askAi' },
      { type: 'paragraph' },
    ],
  }
}

/* ── DEMO PAGE 2 · Roadmap — every MEDIA / WIDGET block (Blocks-2) ───────── */
function roadmap(): JSONContent {
  return {
    type: 'doc',
    content: [
      paragraph([
        text(
          'One page with every widget, exactly like the design sheet — hover anything for its controls.'
        ),
      ]),
      heading(2, 'Media'),
      {
        type: 'mediaImage',
        attrs: {
          src: sketch,
          caption: 'Key flow sketch',
          alt: 'Key flow sketch',
          align: 'left',
          vaultFileId: null,
        },
      },
      {
        type: 'mediaVideo',
        attrs: { src: '', title: '', duration: '', caption: '', vaultFileId: null },
      },
      {
        type: 'fileBlock',
        attrs: {
          fileName: 'contract.pdf',
          sizeLabel: '2.4 MB',
          mime: 'application/pdf',
          vaultFileId: null,
        },
      },
      {
        type: 'fileBlock',
        attrs: {
          fileName: 'notes-export.md',
          sizeLabel: '18 KB',
          mime: 'text/markdown',
          vaultFileId: null,
        },
      },
      heading(2, 'Links'),
      {
        type: 'bookmark',
        attrs: {
          url: 'https://example.com/zero-knowledge-sync',
          title: 'How zero-knowledge sync works',
          description: 'A plain-language tour of keys, devices and what a server can never see.',
        },
      },
      {
        type: 'embed',
        attrs: { url: 'https://en.wikipedia.org/wiki/Zero-knowledge_proof', allowed: 'never' },
      },
      {
        type: 'noteLink',
        attrs: {
          noteId: 'note-meeting',
          label: 'Meeting Notes',
          excerpt: 'Q3 planning session with the team…',
        },
      },
      { type: 'childPage', attrs: { label: 'Meeting notes', noteId: 'note-meeting-child' } },
      heading(2, 'Widgets'),
      {
        type: 'callout',
        attrs: { tone: 'info' },
        content: [
          paragraph([text('The kanban board view was removed — this wall keeps its cards.')]),
        ],
      },
      { type: 'sticky', attrs: { text: 'Call about the key backup', color: 'yellow' } },
      { type: 'sticky', attrs: { text: 'Try the safe mode', color: 'pink' } },
      { type: 'secret', attrs: { text: 'correct horse battery', revealed: false } },
      { type: 'askAi' },
      { type: 'paragraph' },
    ],
  }
}

/* ── DEMO TOUR · "All modules demo" — EVERY module on ONE page ───────────── */
function allModulesDemo(): JSONContent {
  return {
    type: 'doc',
    content: [
      paragraph([
        text('One page, every module. Type '),
        text('/', [{ type: 'code' }]),
        text(
          ' on any empty line to insert more. Hover a block for its handle, drag to select blocks, and click the table cells, tabs and menus — everything below is live. '
        ),
        text('Colored text', [{ type: 'noteTextColor', attrs: { shade: 'blue' } }]),
        text(' and '),
        text('themed highlight', [{ type: 'noteTextBg', attrs: { shade: 'yellow' } }]),
        text(' come from the same tokens as the rest of the UI.'),
      ]),
      { type: 'tableOfContents' },
      heading(1, 'Text and structure'),
      paragraph([
        text('Inline marks: '),
        text('bold', [{ type: 'bold' }]),
        text(', '),
        text('italic', [{ type: 'italic' }]),
        text(', '),
        text('strike', [{ type: 'strike' }]),
        text(', '),
        text('code', [{ type: 'code' }]),
        text(', '),
        text('a link', [
          {
            type: 'link',
            attrs: {
              href: 'https://example.com',
              target: '_blank',
              rel: 'noopener noreferrer nofollow',
              class: 'note-link',
            },
          },
        ]),
        text(', '),
        text('highlighted', [{ type: 'highlight', attrs: { color: '#fde68a' } }]),
        text(', H'),
        text('2', [{ type: 'subscript' }]),
        text(' and cm'),
        text('3', [{ type: 'superscript' }]),
        text('.'),
      ]),
      heading(3, 'Heading 3 — a section sub-title'),
      heading(4, 'Heading 4 — the minor rung'),
      {
        type: 'blockquote',
        content: [paragraph([text('Typing should never wait on the network.')])],
      },
      heading(2, 'Lists'),
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [paragraph([text('Zero-knowledge links')])] },
          {
            type: 'listItem',
            content: [
              paragraph([text('Offline sync')]),
              {
                type: 'bulletList',
                content: [{ type: 'listItem', content: [paragraph([text('Safe merge')])] }],
              },
            ],
          },
        ],
      },
      {
        type: 'orderedList',
        content: [
          { type: 'listItem', content: [paragraph([text('Write it')])] },
          { type: 'listItem', content: [paragraph([text('Seal it')])] },
          { type: 'listItem', content: [paragraph([text('Share it')])] },
        ],
      },
      {
        type: 'taskList',
        content: [
          task('Write the spec', true),
          task('Review the crypto', true),
          task('Ship the alpha', false),
        ],
      },
      {
        type: 'toggleBlock',
        attrs: { open: false },
        content: [
          paragraph([text('Open questions')]),
          paragraph([text('How do share links expire? Who can revoke them?')]),
        ],
      },
      heading(2, 'Callouts'),
      {
        type: 'callout',
        attrs: { tone: 'secure' },
        content: [paragraph([text('Keys never leave this device.')])],
      },
      {
        type: 'callout',
        attrs: { tone: 'success' },
        content: [paragraph([text('Backup verified.')])],
      },
      {
        type: 'callout',
        attrs: { tone: 'warning' },
        content: [paragraph([text('Share links expire in 7 days.')])],
      },
      heading(2, 'Dividers'),
      { type: 'divider', attrs: { variant: 'line' } },
      { type: 'divider', attrs: { variant: 'dot' } },
      { type: 'divider', attrs: { variant: 'dash' } },
      heading(2, 'Code and math'),
      {
        type: 'codeBlock',
        attrs: { language: 'typescript' },
        content: [
          text('const key = derive(pass)\nconst sealed = seal(note, key)\nawait vault.put(sealed)'),
        ],
      },
      { type: 'equation', attrs: { formula: 'a² + b² = c²' } },
      { type: 'equation', attrs: { formula: 'E = mc²' } },
      heading(2, 'Columns'),
      {
        type: 'columns',
        attrs: { count: 2, widths: [50, 50] },
        content: [
          {
            type: 'column',
            content: [
              heading(3, 'Now'),
              paragraph([
                text('Share links are in review; the column divider only shows on hover.'),
              ]),
            ],
          },
          {
            type: 'column',
            content: [
              heading(3, 'Next'),
              {
                type: 'taskList',
                content: [task('Draft the offline merge spec', false)],
              },
            ],
          },
        ],
      },
      heading(2, 'Table'),
      paragraph([
        text(
          'Click a cell to type. Hover for the dash (table menu), the row and column grips, drag the blue border to resize, and use the bottom bar to add rows.'
        ),
      ]),
      demoTable(),
      heading(2, 'Board view'),
      {
        type: 'callout',
        attrs: { tone: 'info' },
        content: [
          paragraph([text('The kanban board view was removed — this wall keeps its cards.')]),
        ],
      },
      heading(2, 'Media'),
      {
        type: 'mediaImage',
        attrs: {
          src: sketch,
          caption: 'Key flow sketch',
          alt: 'Key flow sketch',
          align: 'left',
          vaultFileId: null,
        },
      },
      {
        type: 'mediaVideo',
        attrs: { src: '', title: '', duration: '', caption: '', vaultFileId: null },
      },
      {
        type: 'audioBlock',
        attrs: {
          src: '',
          title: 'Standup recording',
          duration: '1:02',
          vaultFileId: null,
        },
      },
      {
        type: 'fileBlock',
        attrs: {
          fileName: 'contract.pdf',
          sizeLabel: '2.4 MB',
          mime: 'application/pdf',
          vaultFileId: null,
        },
      },
      {
        type: 'fileBlock',
        attrs: {
          fileName: 'notes-export.md',
          sizeLabel: '18 KB',
          mime: 'text/markdown',
          vaultFileId: null,
        },
      },
      heading(2, 'Links'),
      {
        type: 'bookmark',
        attrs: {
          url: 'https://example.com/zero-knowledge-sync',
          title: 'How zero-knowledge sync works',
          description: 'A plain-language tour of keys, devices and what a server can never see.',
        },
      },
      {
        type: 'embed',
        attrs: { url: 'https://en.wikipedia.org/wiki/Zero-knowledge_proof', allowed: 'never' },
      },
      {
        type: 'noteLink',
        attrs: {
          noteId: 'note-meeting',
          label: 'Meeting Notes',
          excerpt: 'Q3 planning session with the team…',
        },
      },
      { type: 'childPage', attrs: { label: 'Inside the demo', noteId: 'note-module-demo-child' } },
      heading(2, 'Widgets'),
      { type: 'sticky', attrs: { text: 'Call about the key backup', color: 'yellow' } },
      { type: 'sticky', attrs: { text: 'Try the safe mode', color: 'pink' } },
      { type: 'secret', attrs: { text: 'correct horse battery', revealed: false } },
      { type: 'askAi' },
      { type: 'paragraph' },
    ],
  }
}

/**
 * The demo tour: ONE pinned page with every module (plus its child page so
 * the child-page block opens something). The repository merges these ids
 * into saved workspaces on load — see localNoteRepository.ensureDemoTour.
 */
export function demoTourNotes(now = new Date()): NoteRecord[] {
  const iso = now.toISOString()
  return [
    note({
      id: 'note-module-demo',
      title: 'All modules demo',
      tags: ['demo'],
      order: -20,
      starred: false,
      pinned: true,
      trashed: false,
      updatedAt: iso,
      background: 'sky',
      icon: '🧩',
      cover: 'hills',
      content: allModulesDemo(),
    }),
    note({
      id: 'note-module-demo-child',
      title: 'Inside the demo',
      tags: ['demo'],
      order: -10,
      starred: false,
      pinned: false,
      trashed: false,
      parentNoteId: 'note-module-demo',
      updatedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      icon: '🗂️',
      content: short(
        'Child page of the demo — opened by the child-page block. Every module lives on the parent page.'
      ),
    }),
  ]
}

/** Document each template writes into a fresh note. */
export function templateStarterDocument(template: NoteTemplate): JSONContent {
  switch (template.starter) {
    case 'todo':
      return {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [task('', false)],
          },
        ],
      }
    case 'daily':
      return {
        type: 'doc',
        content: [
          paragraph([text('How did today feel? ')]),
          {
            type: 'callout',
            attrs: { tone: 'secure' },
            content: [paragraph([text('One line you would not say out loud.')])],
          },
        ],
      }
    case 'meeting':
      return {
        type: 'doc',
        content: [
          heading(2, 'Agenda'),
          { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
          heading(2, 'Actions'),
          {
            type: 'taskList',
            content: [task('', false)],
          },
        ],
      }
    case 'project':
      return {
        type: 'doc',
        content: [
          heading(2, 'Roadmap'),
          {
            type: 'columns',
            attrs: { count: 2, widths: [50, 50] },
            content: [
              { type: 'column', content: [paragraph([text('Now')])] },
              { type: 'column', content: [paragraph([text('Next')])] },
            ],
          },
        ],
      }
    case 'blank':
    default:
      return { type: 'doc', content: [{ type: 'paragraph' }] }
  }
}

/** Sample workspace used the first time this browser has no saved notes. */
export function seedNotes(now = new Date()): NoteRecord[] {
  const iso = now.toISOString()
  return [
    /* DEMO TOUR first — one pinned page with every module. */
    ...demoTourNotes(now),
    note({
      id: 'note-meeting',
      title: 'Meeting Notes',
      tags: ['work'],
      order: 0,
      starred: true,
      pinned: true,
      trashed: false,
      updatedAt: new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString(),
      background: 'mist',
      icon: '📅',
      content: short(
        'Q3 planning session with the team. Decisions stay on this device until sync exists.'
      ),
    }),
    /* DEMO PAGE 1 — every writing block. */
    note({
      id: 'note-project-ideas',
      title: 'Project Ideas',
      tags: ['ideas', 'product'],
      order: 10,
      starred: false,
      pinned: false,
      trashed: false,
      updatedAt: iso,
      background: 'sky',
      icon: '💡',
      cover: 'hills',
      content: projectIdeas(),
    }),
    /* DEMO PAGE 2 — every media/widget block. */
    note({
      id: 'note-roadmap',
      title: 'Roadmap',
      tags: ['ideas'],
      order: 11,
      starred: false,
      pinned: false,
      trashed: false,
      parentNoteId: 'note-project-ideas',
      updatedAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      icon: '🛣️',
      cover: 'circles',
      content: roadmap(),
    }),
    note({
      id: 'note-meeting-child',
      title: 'Meeting notes',
      tags: ['work'],
      order: 12,
      starred: false,
      pinned: false,
      trashed: false,
      parentNoteId: 'note-project-ideas',
      updatedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      icon: '📝',
      content: short('Child page of Project Ideas — decisions from the last sync.'),
    }),
    /* The sheet hides these three behind "Show 3 more" — plausible siblings
       so the preview count matches the reference exactly (2 shown of 5). */
    note({
      id: 'note-design-drafts',
      title: 'Design drafts',
      tags: ['ideas'],
      order: 13,
      starred: false,
      pinned: false,
      trashed: false,
      parentNoteId: 'note-project-ideas',
      updatedAt: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(),
      icon: '🎨',
      content: short('Child page of Project Ideas — open sketches for the vault UI.'),
    }),
    note({
      id: 'note-research',
      title: 'Research',
      tags: ['learning'],
      order: 14,
      starred: false,
      pinned: false,
      trashed: false,
      parentNoteId: 'note-project-ideas',
      updatedAt: new Date(now.getTime() - 30 * 60 * 60 * 1000).toISOString(),
      icon: '🔬',
      content: short('Child page of Project Ideas — papers and benchmarks worth keeping.'),
    }),
    note({
      id: 'note-backlog',
      title: 'Backlog',
      tags: ['product'],
      order: 15,
      starred: false,
      pinned: false,
      trashed: false,
      parentNoteId: 'note-project-ideas',
      updatedAt: new Date(now.getTime() - 40 * 60 * 60 * 1000).toISOString(),
      icon: '📦',
      content: short('Child page of Project Ideas — everything not scheduled yet.'),
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
      icon: '📖',
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
      icon: '🔄',
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
      icon: '💼',
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
      icon: '🗑️',
      content: short('An older outline kept in trash so restore and delete can be tried locally.'),
    }),
  ]
}
