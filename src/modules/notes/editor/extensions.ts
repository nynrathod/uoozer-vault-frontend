import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Typography from '@tiptap/extension-typography'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import {
  Sparkles,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  ListTodo,
  ChevronRight,
  Smile,
  LayoutGrid,
  Quote,
  Image,
  Video,
  File,
  Code2,
  Table as TableIcon,
  Lock,
  Minus,
  Tag,
  Bookmark,
} from 'lucide-react'
import { noteUiBus } from '../bus'
import { chooseFile, chooseImage, chooseVideo } from './commands'
import { NoteTextColor, NoteTextBg } from './colors'
import { Bookmark as BookmarkNode } from './nodes/Bookmark'
import { Callout } from './nodes/Callout'
import { Columns, Column, columnsContent } from './nodes/Columns'
import { FileBlock } from './nodes/FileBlock'
import { MediaImage } from './nodes/MediaImage'
import { MediaVideo } from './nodes/MediaVideo'
import {
  UoozerTable,
  UoozerTableCell,
  UoozerTableHeader,
  UoozerTableRow,
} from './nodes/UoozerTable'
import { StatusPill } from './nodes/StatusPill'
import { ToggleBlock, insertToggleBlock } from './nodes/ToggleBlock'
import { VaultCodeBlock } from './nodes/VaultCodeBlock'
import { emitUiEvent } from './uiEvents'
import { getEditorExtensions, getSlashCommands, registerEditorModule } from './registry'

let ready = false

/**
 * Editor modules in display order: core → lists → media → advanced.
 * Registration order is the single source of truth for how the slash menu
 * groups categories (AI, Basic, Media, Advanced), matching the reference layout.
 * The `featured` flag surfaces the top/most-used modules before typing.
 */
function registerModules() {
  registerEditorModule({
    id: 'core',
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        codeBlock: false,
        link: false,
      }),
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
        placeholder: ({ editor, node }) =>
          editor.isEmpty && node.type.name === 'paragraph' ? 'Write, or type / for blocks' : '',
      }),
      VaultCodeBlock.configure({ defaultLanguage: 'typescript' }),
    ],
    commands: [
      {
        id: 'ask-ai',
        label: 'Ask AI',
        description: 'Summarize this note in the browser',
        category: 'ai',
        keywords: ['ai', 'summary', 'ask'],
        icon: Sparkles,
        featured: true,
        hint: 'Nothing leaves this device.',
        run: () => noteUiBus.emit({ type: 'assistant.open' }),
      },
      {
        id: 'text',
        label: 'Text',
        description: 'Plain paragraph',
        category: 'basic',
        keywords: ['paragraph', 'text'],
        icon: Type,
        featured: true,
        run: (editor) => editor.chain().focus().setParagraph().run(),
      },
      {
        id: 'heading-1',
        label: 'Heading 1',
        description: 'Large section title',
        category: 'basic',
        keywords: ['h1', 'title', 'heading'],
        icon: Heading1,
        featured: true,
        run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        id: 'heading-2',
        label: 'Heading 2',
        description: 'Section heading',
        category: 'basic',
        keywords: ['h2', 'heading'],
        icon: Heading2,
        featured: true,
        run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        id: 'heading-3',
        label: 'Heading 3',
        description: 'Small section heading',
        category: 'basic',
        keywords: ['h3', 'subheading', 'heading'],
        icon: Heading3,
        run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        id: 'heading-4',
        label: 'Heading 4',
        description: 'Minor heading inside a section',
        category: 'basic',
        keywords: ['h4', 'subheading', 'heading'],
        icon: Heading4,
        run: (editor) => editor.chain().focus().toggleHeading({ level: 4 }).run(),
      },
      {
        id: 'quote',
        label: 'Quote',
        description: 'Set a line apart',
        category: 'basic',
        keywords: ['quote', 'blockquote'],
        icon: Quote,
        featured: true,
        run: (editor) => editor.chain().focus().toggleBlockquote().run(),
      },
      {
        id: 'emoji',
        label: 'Emoji',
        description: 'Drop an emoji anywhere in the note',
        category: 'basic',
        keywords: ['emoji', 'smiley', 'icon', 'emoticon'],
        icon: Smile,
        featured: true,
        run: () => emitUiEvent({ type: 'emoji.open' }),
      },
    ],
  })

  registerEditorModule({
    id: 'lists',
    extensions: [TaskList, TaskItem.configure({ nested: true })],
    commands: [
      {
        id: 'bullet-list',
        label: 'Bullet list',
        description: 'Simple bulleted list',
        category: 'basic',
        keywords: ['bullet', 'unordered', 'list', 'ul'],
        icon: List,
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
        featured: true,
        run: (editor) => insertToggleBlock(editor),
      },
    ],
  })

  registerEditorModule({
    id: 'media',
    extensions: [MediaImage, MediaVideo, FileBlock],
    commands: [
      {
        id: 'image',
        label: 'Image',
        description: 'Upload, paste, or drag a picture into the note',
        category: 'media',
        keywords: ['image', 'photo', 'picture'],
        icon: Image,
        featured: true,
        hint: 'Encrypted on this device before it syncs.',
        run: (editor) => chooseImage(editor),
      },
      {
        id: 'video',
        label: 'Video',
        description: 'Plays in the note. The file stays in this browser session',
        category: 'media',
        keywords: ['video', 'movie'],
        icon: Video,
        featured: true,
        hint: 'Stays in this browser session until sync.',
        run: (editor) => chooseVideo(editor),
      },
      {
        id: 'file',
        label: 'File',
        description: 'Reference a file until vault sync',
        category: 'media',
        keywords: ['file', 'attachment'],
        icon: File,
        featured: true,
        hint: 'Referenced locally until vault sync.',
        run: (editor) => chooseFile(editor),
      },
      {
        id: 'bookmark',
        label: 'Bookmark',
        description: 'Save a link as a rich card',
        category: 'media',
        keywords: ['bookmark', 'link', 'url', 'web'],
        icon: Bookmark,
        run: (editor) =>
          editor
            .chain()
            .focus()
            .insertContent({ type: 'bookmark', attrs: { url: '', title: '' } })
            .run(),
      },
    ],
  })

  registerEditorModule({
    id: 'blocks',
    extensions: [
      BookmarkNode,
      Callout,
      StatusPill,
      ToggleBlock,
      Columns,
      Column,

      UoozerTable,
      UoozerTableRow,
      UoozerTableHeader,
      UoozerTableCell,
    ],
    commands: [
      {
        id: 'callout',
        label: 'Callout',
        description: 'A quiet security note',
        category: 'advanced',
        keywords: ['callout', 'lock', 'info'],
        icon: Lock,
        run: (editor) =>
          editor
            .chain()
            .focus()
            .insertContent({ type: 'callout', content: [{ type: 'paragraph' }] })
            .run(),
      },
      {
        id: 'table',
        label: 'Table',
        description: 'Feature, status, and area',
        category: 'advanced',
        keywords: ['table', 'grid'],
        icon: TableIcon,
        run: (editor) =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      },
      {
        id: 'columns-2',
        label: '2 columns',
        description: 'Two side-by-side columns, blocks nest inside',
        category: 'advanced',
        keywords: ['columns', 'grid', 'layout', 'split', 'two'],
        icon: LayoutGrid,
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
        run: (editor) => editor.chain().focus().insertContent(columnsContent(3)).run(),
      },
      {
        id: 'columns-4',
        label: '4 columns',
        description: 'Four side-by-side columns',
        category: 'advanced',
        keywords: ['columns', 'grid', 'layout', 'split', 'four'],
        icon: LayoutGrid,
        run: (editor) => editor.chain().focus().insertContent(columnsContent(4)).run(),
      },
      {
        id: 'columns-5',
        label: '5 columns',
        description: 'Five side-by-side columns',
        category: 'advanced',
        keywords: ['columns', 'grid', 'layout', 'split', 'five'],
        icon: LayoutGrid,
        run: (editor) => editor.chain().focus().insertContent(columnsContent(5)).run(),
      },
      {
        id: 'divider',
        label: 'Divider',
        description: 'A horizontal break',
        category: 'advanced',
        keywords: ['hr', 'divider', 'line'],
        icon: Minus,
        run: (editor) => editor.chain().focus().setHorizontalRule().run(),
      },
      {
        id: 'status',
        label: 'Status',
        description: 'Inline planned or progress pill',
        category: 'advanced',
        keywords: ['status', 'pill', 'badge'],
        icon: Tag,
        run: (editor) =>
          editor
            .chain()
            .focus()
            .insertContent({ type: 'statusPill', attrs: { label: 'Planned', tone: 'planned' } })
            .run(),
      },
      {
        id: 'code',
        label: 'Code block',
        description: 'Snippet with a language label',
        category: 'advanced',
        keywords: ['code', 'snippet'],
        icon: Code2,
        featured: true,
        run: (editor) => editor.chain().focus().toggleCodeBlock({ language: 'typescript' }).run(),
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
