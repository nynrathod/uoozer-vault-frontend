import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Typography from '@tiptap/extension-typography'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TaskItem from '@tiptap/extension-task-item'
import {
  Bookmark as BookmarkIcon,
  Braces,
  ChevronRight,
  Code2,
  Columns2,
  Eye,
  File as FileIcon,
  FilePlus2,
  Heading1 as Heading1Icon,
  Heading2 as Heading2Icon,
  Heading3 as Heading3Icon,
  Heading4 as Heading4Icon,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Lock,
  Minus,
  Music,
  Quote,
  Smile,
  Sparkles,
  Square,
  StickyNote as StickyNoteIcon,
  Table as TableIcon,
  Type,
  Video,
  Wand2,
} from 'lucide-react'
import { noteUiBus } from '../bus'
import {
  chooseAudio,
  chooseFile,
  chooseImage,
  chooseVideo,
  insertAskAi,
  insertBookmark,
  insertCallout,
  insertChildPage,
  insertDivider,
  insertEmbed,
  insertEquation,
  insertSecret,
  insertSticky,
  insertTableOfContents,
} from './commands'
import { NoteTextColor, NoteTextBg } from './colors'
import { emitUiEvent } from './uiEvents'
import { getEditorExtensions, getSlashCommands, registerEditorModule } from './registry'
import {
  AudioBlock,
  Bookmark,
  ChildPage,
  Divider,
  Embed,
  Equation,
  AskAiBlock,
  MediaImage,
  MediaVideo,
  NoteLink,
  Secret,
  StickyBoard,
  StickyNote,
  TableOfContents,
  TaskListWithProgress,
} from './nodes'
import { Callout } from './nodes/Callout'
import { Column, Columns, columnsContent } from './nodes/Columns'
import { FileBlock } from './nodes/FileBlock'
import { ToggleBlock, insertToggleBlock } from './nodes/ToggleBlock'
import { VaultCodeBlock } from './nodes/VaultCodeBlock'
import {
  SimpleTable,
  SimpleTableCell,
  SimpleTableHeader,
  SimpleTableRow,
} from './nodes/SimpleTable'

let ready = false

function registerModules() {
  /* ── Core: schema basics + writing structure ─────────────────────────── */
  registerEditorModule({
    id: 'core',
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        codeBlock: false,
        link: false,
        horizontalRule: false,
      }),
      Divider,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: { class: 'note-link', rel: 'noopener noreferrer nofollow' },
      }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Typography,
      Subscript,
      Superscript,
      // Theme-aware text color + highlight system (names only; values in CSS).
      NoteTextColor,
      NoteTextBg,
      Placeholder.configure({
        placeholder: ({ editor, node, pos }) => {
          if (node.type.name !== 'paragraph') return ''
          if (editor.isEmpty && !pos) return 'Write, or type / for blocks'
          // Empty paragraph inside a widget: show where to write.
          if (typeof pos === 'number') {
            try {
              const parent = editor.state.doc.resolve(pos).parent
              if (parent.type.name === 'callout') return 'Type a note…'
              if (parent.type.name === 'toggleBlock') return 'Toggle title'
              if (parent.type.name === 'column') return ''
            } catch {
              /* position not resolvable during a re-render */
            }
          }
          return ''
        },
      }),
      VaultCodeBlock.configure({ defaultLanguage: 'typescript' }),
    ],
    commands: [
      {
        id: 'text',
        label: 'Text',
        description: 'Plain paragraph',
        category: 'basic',
        keywords: ['paragraph', 'text'],
        icon: Type,
        shortcut: 'p',
        featured: true,
        run: (editor) => editor.chain().focus().setParagraph().run(),
      },
      {
        id: 'heading-1',
        label: 'Heading 1',
        description: 'Large section title',
        category: 'basic',
        keywords: ['h1', 'title', 'heading'],
        icon: Heading1Icon,
        shortcut: '#',
        run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        id: 'heading-2',
        label: 'Heading 2',
        description: 'Section heading',
        category: 'basic',
        keywords: ['h2', 'heading'],
        icon: Heading2Icon,
        shortcut: '##',
        run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        id: 'heading-3',
        label: 'Heading 3',
        description: 'Small section heading',
        category: 'basic',
        keywords: ['h3', 'subheading', 'heading'],
        icon: Heading3Icon,
        shortcut: '###',
        run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        id: 'heading-4',
        label: 'Heading 4',
        description: 'Minor heading inside a section',
        category: 'basic',
        keywords: ['h4', 'subheading', 'heading'],
        icon: Heading4Icon,
        shortcut: '####',
        run: (editor) => editor.chain().focus().toggleHeading({ level: 4 }).run(),
      },
      {
        id: 'quote',
        label: 'Quote',
        description: 'Set a line apart',
        category: 'basic',
        keywords: ['quote', 'blockquote'],
        icon: Quote,
        shortcut: '>',
        featured: true,
        run: (editor) => editor.chain().focus().toggleBlockquote().run(),
      },
      {
        id: 'bullet-list',
        label: 'Bullet list',
        description: 'Simple bulleted list',
        category: 'basic',
        keywords: ['bullet', 'unordered', 'list', 'ul'],
        icon: List,
        shortcut: '-',
        featured: true,
        run: (editor) => editor.chain().focus().toggleBulletList().run(),
      },
      {
        id: 'numbered-list',
        label: 'Numbered list',
        description: 'List with ordered steps',
        category: 'basic',
        keywords: ['numbered', 'ordered', 'list', 'ol'],
        icon: ListOrdered,
        shortcut: '1.',
        featured: true,
        run: (editor) => editor.chain().focus().toggleOrderedList().run(),
      },
      {
        id: 'checklist',
        label: 'To-do list',
        description: 'Track items with checkboxes',
        category: 'basic',
        keywords: ['todo', 'task', 'check', 'list'],
        icon: ListTodo,
        shortcut: '[]',
        featured: true,
        run: (editor) => editor.chain().focus().toggleTaskList().run(),
      },
      {
        id: 'toggle-list',
        label: 'Toggle list',
        description: 'Collapsible section with a heading line',
        category: 'basic',
        keywords: ['toggle', 'collapse', 'details', 'expand', 'list'],
        icon: ChevronRight,
        shortcut: '>>',
        featured: true,
        run: (editor) => insertToggleBlock(editor),
      },
      {
        id: 'divider',
        label: 'Divider',
        description: 'A horizontal break — line, dots or a short rule',
        category: 'basic',
        keywords: ['hr', 'divider', 'line', 'rule'],
        icon: Minus,
        shortcut: '---',
        run: (editor) => insertDivider(editor),
      },
      {
        id: 'emoji',
        label: 'Emoji',
        description: 'Drop an emoji anywhere in the note',
        category: 'basic',
        keywords: ['emoji', 'smiley', 'icon', 'emoticon'],
        icon: Smile,
        shortcut: ':',
        featured: true,
        run: () => emitUiEvent({ type: 'emoji.open' }),
      },
    ],
  })

  /* ── Lists schema (task lists with the Blocks-1 progress row) ─────────── */
  registerEditorModule({
    id: 'lists',
    extensions: [TaskListWithProgress, TaskItem.configure({ nested: true })],
  })

  /* ── Links: child pages and link-to-note cards ───────────────────── */
  registerEditorModule({
    id: 'links',
    extensions: [ChildPage, NoteLink],
    commands: [
      {
        id: 'child-page',
        label: 'Child page',
        description: 'Pages inside pages — opens as its own note',
        category: 'links',
        keywords: ['page', 'child', 'sub-page', 'subpage'],
        icon: FilePlus2,
        shortcut: '/page',
        featured: true,
        run: (editor) => insertChildPage(editor),
      },
      {
        id: 'link-to-note',
        label: 'Link to note',
        description: 'A card that opens another note',
        category: 'links',
        keywords: ['link', 'note', 'reference', 'wiki'],
        icon: Link2,
        shortcut: '[[',
        featured: true,
        run: () => emitUiEvent({ type: 'link.open' }),
      },
    ],
  })

  /* ── Media: image · video · audio · file · bookmark · embed ──────────── */
  registerEditorModule({
    id: 'media',
    extensions: [MediaImage, MediaVideo, AudioBlock, FileBlock, Bookmark, Embed],
    commands: [
      {
        id: 'image',
        label: 'Image',
        description: 'Upload, paste, or drop a picture into the note',
        category: 'media',
        keywords: ['image', 'photo', 'picture'],
        icon: ImageIcon,
        shortcut: '/image',
        featured: true,
        hint: 'Encrypted on this device before it syncs.',
        run: (editor) => chooseImage(editor),
      },
      {
        id: 'video',
        label: 'Video',
        description: 'Streams in encrypted chunks; no autoplay',
        category: 'media',
        keywords: ['video', 'movie', 'film'],
        icon: Video,
        shortcut: '/video',
        featured: true,
        hint: 'Stays in this browser session until sync.',
        run: (editor) => chooseVideo(editor),
      },
      {
        id: 'audio',
        label: 'Audio',
        description: 'Voice memo or track with a player',
        category: 'media',
        keywords: ['audio', 'music', 'voice', 'sound', 'memo'],
        icon: Music,
        shortcut: '/audio',
        hint: 'Stays in this browser session until sync.',
        run: (editor) => chooseAudio(editor),
      },
      {
        id: 'file',
        label: 'File',
        description: 'Attach a file to the note — downloadable',
        category: 'media',
        keywords: ['file', 'attachment', 'pdf', 'doc'],
        icon: FileIcon,
        shortcut: '/file',
        featured: true,
        run: (editor) => chooseFile(editor),
      },
      {
        id: 'bookmark',
        label: 'Bookmark',
        description: 'Save a link as a rich card',
        category: 'media',
        keywords: ['bookmark', 'link', 'url', 'web'],
        icon: BookmarkIcon,
        shortcut: '/bookmark',
        run: (editor) => insertBookmark(editor),
      },
      {
        id: 'embed',
        label: 'Embed',
        description: 'Third-party frame — asks before it loads',
        category: 'media',
        keywords: ['embed', 'iframe', 'youtube', 'figma', 'map'],
        icon: Square,
        shortcut: '/embed',
        hint: 'Off by default, so a page can’t track your reading.',
        run: (editor) => insertEmbed(editor),
      },
    ],
  })

  /* ── Advanced: callout · table · columns · code · equation · toc · board */
  registerEditorModule({
    id: 'blocks',
    extensions: [
      Callout,
      ToggleBlock,
      Columns,
      Column,
      Equation,
      TableOfContents,
      SimpleTable,
      SimpleTableRow,
      SimpleTableHeader,
      SimpleTableCell,
    ],
    commands: [
      {
        id: 'callout',
        label: 'Callout',
        description: 'A quiet security note — blue, green or amber',
        category: 'advanced',
        keywords: ['callout', 'info', 'note', 'panel'],
        icon: Lock,
        shortcut: '/callout',
        featured: true,
        run: (editor) => insertCallout(editor),
      },
      {
        id: 'table',
        label: 'Table',
        description: 'A simple grid — header row, drag handles, resize',
        category: 'advanced',
        keywords: ['table', 'grid', 'spreadsheet'],
        icon: TableIcon,
        shortcut: '/table',
        run: (editor) =>
          editor.chain().focus().insertTable({ rows: 4, cols: 3, withHeaderRow: true }).run(),
      },
      {
        id: 'columns-2',
        label: '2 columns',
        description: 'Two side-by-side columns, blocks nest inside',
        category: 'advanced',
        keywords: ['columns', 'grid', 'layout', 'split', 'two'],
        icon: Columns2,
        shortcut: '/col2',
        featured: true,
        run: (editor) => editor.chain().focus().insertContent(columnsContent(2)).run(),
      },
      {
        id: 'columns-3',
        label: '3 columns',
        description: 'Three side-by-side columns',
        category: 'advanced',
        keywords: ['columns', 'grid', 'layout', 'split', 'three'],
        icon: LayoutGrid,
        shortcut: '/col3',
        run: (editor) => editor.chain().focus().insertContent(columnsContent(3)).run(),
      },
      {
        id: 'columns-4',
        label: '4 columns',
        description: 'Four side-by-side columns',
        category: 'advanced',
        keywords: ['columns', 'grid', 'layout', 'split', 'four'],
        icon: LayoutGrid,
        shortcut: '/col4',
        run: (editor) => editor.chain().focus().insertContent(columnsContent(4)).run(),
      },
      {
        id: 'columns-5',
        label: '5 columns',
        description: 'Five side-by-side columns',
        category: 'advanced',
        keywords: ['columns', 'grid', 'layout', 'split', 'five'],
        icon: LayoutGrid,
        shortcut: '/col5',
        run: (editor) => editor.chain().focus().insertContent(columnsContent(5)).run(),
      },
      {
        id: 'code',
        label: 'Code block',
        description: 'Snippet with a language label',
        category: 'advanced',
        keywords: ['code', 'snippet', 'mono'],
        icon: Code2,
        shortcut: '```',
        featured: true,
        run: (editor) => editor.chain().focus().toggleCodeBlock({ language: 'typescript' }).run(),
      },
      {
        id: 'equation',
        label: 'Equation',
        description: 'Rendered on this device — inline with single $',
        category: 'advanced',
        keywords: ['equation', 'math', 'latex', 'formula'],
        icon: Braces,
        shortcut: '$$',
        run: (editor) => insertEquation(editor),
      },
      {
        id: 'toc',
        label: 'Table of contents',
        description: 'Built from headings — click to jump',
        category: 'advanced',
        keywords: ['contents', 'outline', 'toc', 'headings'],
        icon: List,
        shortcut: '/toc',
        run: (editor) => insertTableOfContents(editor),
      },
    ],
  })

  /* ── Board extras: free-form sticky wall (Note-H sheet) ──────────────── */
  registerEditorModule({
    id: 'sticky-wall',
    extensions: [StickyBoard, StickyNote],
    commands: [
      {
        id: 'sticky',
        label: 'Sticky note',
        description: 'A handwritten-style note on the page',
        category: 'advanced',
        keywords: ['sticky', 'handwriting', 'memo'],
        icon: StickyNoteIcon,
        shortcut: '/sticky',
        run: (editor) => insertSticky(editor),
      },
    ],
  })

  /* ── Secure: blurred secrets ──────────────────────────────────────────── */
  registerEditorModule({
    id: 'secure',
    extensions: [Secret],
    commands: [
      {
        id: 'secret',
        label: 'Secret',
        description: 'Blurred until you reveal it; auto-hides in 10s',
        category: 'secure',
        keywords: ['secret', 'password', 'hide', 'blur', 'private'],
        icon: Eye,
        shortcut: '/secret',
        featured: true,
        hint: 'Auto-hides after 10 seconds.',
        run: (editor) => insertSecret(editor),
      },
    ],
  })

  /* ── AI: asks first, shows the words sent ─────────────────────────────── */
  registerEditorModule({
    id: 'ai',
    extensions: [AskAiBlock],
    commands: [
      {
        id: 'ask-ai',
        label: 'Ask AI',
        description: 'Summarize this note in the browser',
        category: 'ai',
        keywords: ['ai', 'summary', 'ask', 'assistant'],
        icon: Sparkles,
        shortcut: '/ai',
        featured: true,
        hint: 'Nothing leaves this device.',
        run: (editor) => insertAskAi(editor),
      },
      {
        id: 'summarize',
        label: 'Summarize',
        description: 'Three bullets from the whole note',
        category: 'ai',
        keywords: ['summarize', 'summary', 'tldr', 'bullets'],
        icon: Wand2,
        shortcut: '/sum',
        hint: 'Nothing leaves this device.',
        run: () => noteUiBus.emit({ type: 'assistant.open' }),
      },
    ],
  })
}

export function createNoteEditorExtensions() {
  if (!ready) {
    registerModules()
    ready = true
  }
  return getEditorExtensions()
}

export function listSlashCommands() {
  createNoteEditorExtensions()
  return getSlashCommands()
}
