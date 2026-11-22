import { useState } from 'react'
import { X } from 'lucide-react'
import { addTag } from '../../validation'

export function NoteTagRow({
  tags,
  onChange,
  onOpen,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  onOpen: (tag: string) => void
}) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    const next = addTag(tags, draft)
    if (next !== tags) onChange(next)
    setDraft('')
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="bg-secondary/80 text-foreground/75 hover:bg-accent flex items-center gap-0.5 rounded-full py-0.5 pr-1 pl-2.5 text-[12px] font-medium transition-colors duration-150"
        >
          <button
            type="button"
            className="hover:text-primary transition-colors"
            onClick={() => onOpen(tag)}
          >
            #{tag}
          </button>
          <button
            type="button"
            className="text-muted-foreground/60 hover:text-destructive flex h-4 w-4 items-center justify-center rounded-full transition-colors"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(tags.filter((item) => item !== tag))}
          >
            <X className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          }
        }}
        onBlur={commit}
        placeholder="Add tag"
        aria-label="Add tag"
        className="placeholder:text-muted-foreground/50 w-24 rounded-full bg-transparent px-2 py-0.5 text-[12px] transition-[width] duration-150 outline-none focus:w-32"
      />
    </div>
  )
}
