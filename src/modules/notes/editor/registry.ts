import type { AnyExtension, Editor } from '@tiptap/core'
import type { LucideIcon } from 'lucide-react'

export type SlashCategory = 'basic' | 'links' | 'media' | 'advanced' | 'secure' | 'ai'

export interface SlashCommand {
  id: string
  label: string
  description: string
  category: SlashCategory
  keywords: string[]
  icon: LucideIcon
  /** Markdown alias shown on the right of the menu (e.g. `#`, `[]`, ``` ```). */
  shortcut?: string
  /**
   * Top/most-used modules show up front in the slash menu before anything
   * is typed. Everything else stays reachable by typing to search.
   */
  featured?: boolean
  /** Green lock line rendered under the preview description. */
  hint?: string
  run: (editor: Editor) => void
}

export interface EditorModule {
  id: string
  /**
   * The TipTap schema this module contributes. Command-only modules (like
   * AI, which only opens the assistant) may omit it.
   */
  extensions?: AnyExtension[]
  commands?: SlashCommand[]
}

const modules: EditorModule[] = []

export function registerEditorModule(module: EditorModule) {
  const index = modules.findIndex((item) => item.id === module.id)
  if (index >= 0) modules[index] = module
  else modules.push(module)
}

export function getEditorExtensions(): AnyExtension[] {
  return modules.flatMap((module) => module.extensions ?? [])
}

export function getSlashCommands(): SlashCommand[] {
  return modules.flatMap((module) => module.commands ?? [])
}

/** Category display order (Slash menu v2 groups). */
export const SLASH_CATEGORY_ORDER: SlashCategory[] = [
  'basic',
  'links',
  'media',
  'advanced',
  'secure',
  'ai',
]

export const SLASH_CATEGORY_LABEL: Record<SlashCategory, string> = {
  basic: 'Basic',
  links: 'Links',
  media: 'Media',
  advanced: 'Advanced',
  secure: 'Secure',
  ai: 'AI',
}
