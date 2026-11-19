import type { AnyExtension, Editor } from '@tiptap/core'
import type { LucideIcon } from 'lucide-react'

export type SlashCategory = 'ai' | 'basic' | 'media' | 'advanced'

export interface SlashCommand {
  id: string
  label: string
  description: string
  category: SlashCategory
  keywords: string[]
  icon: LucideIcon
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
  extensions: AnyExtension[]
  commands?: SlashCommand[]
}

const modules: EditorModule[] = []

export function registerEditorModule(module: EditorModule) {
  const index = modules.findIndex((item) => item.id === module.id)
  if (index >= 0) modules[index] = module
  else modules.push(module)
}

export function getEditorExtensions(): AnyExtension[] {
  return modules.flatMap((module) => module.extensions)
}

export function getSlashCommands(): SlashCommand[] {
  return modules.flatMap((module) => module.commands ?? [])
}
