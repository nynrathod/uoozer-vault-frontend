import {
  Archive,
  BookOpen,
  Box,
  File,
  FileCode,
  FileText,
  Image,
  Music,
  Video,
  type LucideIcon,
} from 'lucide-react'

export type FileCategory =
  | 'image'
  | 'pdf'
  | 'video'
  | 'audio'
  | 'markdown'
  | 'code'
  | 'text'
  | 'epub'
  | '3d'
  | 'zip'
  | 'other'

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico']
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'ogv']
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac']
const MARKDOWN_EXTS = ['md', 'markdown']
const PLAIN_TEXT_EXTS = ['txt', 'log', 'csv', 'tsv']
const EPUB_EXTS = ['epub']
const MODEL_EXTS = ['gltf', 'glb']
const CODE_EXTS = new Set([
  'js',
  'ts',
  'tsx',
  'jsx',
  'rs',
  'py',
  'go',
  'java',
  'c',
  'cpp',
  'cs',
  'rb',
  'php',
  'swift',
  'kt',
  'scala',
  'sh',
  'bash',
  'zsh',
  'ps1',
  'bat',
  'cmd',
  'sql',
  'json',
  'xml',
  'html',
  'css',
  'scss',
  'less',
  'yaml',
  'yml',
  'toml',
  'ini',
  'conf',
  'config',
  'env',
  'dockerfile',
  'vue',
  'svelte',
  'graphql',
  'gql',
])

/** Maps a file name to its preview category (extension driven). */
export function getCategory(fileName: string): FileCategory {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (ext === 'zip') return 'zip'
  if (IMAGE_EXTS.includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (VIDEO_EXTS.includes(ext)) return 'video'
  if (AUDIO_EXTS.includes(ext)) return 'audio'
  if (MARKDOWN_EXTS.includes(ext)) return 'markdown'
  if (PLAIN_TEXT_EXTS.includes(ext)) return 'text'
  if (CODE_EXTS.has(ext)) return 'code'
  if (EPUB_EXTS.includes(ext)) return 'epub'
  if (MODEL_EXTS.includes(ext)) return '3d'
  return 'other'
}

const CATEGORY_ICONS: Record<FileCategory, LucideIcon> = {
  image: Image,
  pdf: FileText,
  video: Video,
  audio: Music,
  markdown: FileText,
  code: FileCode,
  text: FileText,
  epub: BookOpen,
  '3d': Box,
  zip: Archive,
  other: File,
}

/** Header glyph for a category (rendered 18px ghost, per the sheet). */
export function getPreviewIcon(category: FileCategory): LucideIcon {
  return CATEGORY_ICONS[category] ?? File
}

/** Extensions that can be rendered inside the preview viewer. */
export function isPreviewableCategory(category: FileCategory): boolean {
  return category !== 'zip' && category !== 'other'
}
