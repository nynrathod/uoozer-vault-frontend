import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, File, Folder as FolderIcon } from 'lucide-react'
import { useUIStore } from '@stores/uiStore'
import { cn, formatBytes } from '@lib/utils'
import type { FileItem } from '@/types/filtes'
import type { Folder } from '@/types/folders'

interface SearchCommandProps {
  files: FileItem[]
  folders: Folder[]
}

export function SearchCommand({ files, folders }: SearchCommandProps) {
  const [query, setQuery] = useState('')
  const open = useUIStore((s) => s.searchOpen)
  const setOpen = useUIStore((s) => s.setSearchOpen)
  const navigate = useNavigate()

  const allItems = [
    ...folders.map((f) => ({ ...f, type: 'folder' as const })),
    ...files.map((f) => ({ ...f, type: 'file' as const })),
  ]

  const filtered = query.trim()
    ? allItems.filter((item) => item.encryptedName.toLowerCase().includes(query.toLowerCase()))
    : allItems.slice(0, 10)

  const handleSelect = useCallback(
    (item: (typeof allItems)[number]) => {
      setOpen(false)
      if (item.type === 'folder') {
        navigate(`/vault/folder/${item.id}`)
      }
    },
    [navigate, setOpen]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(!open)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, setOpen])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-150"
      onClick={() => setOpen(false)}
    >
      <div className="flex items-start justify-center px-4 pt-[15vh]">
        <div
          className="border-border/60 bg-card w-full max-w-xl overflow-hidden rounded-2xl border shadow-xl transition-all duration-150 ease-out"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-border/60 flex items-center gap-3 border-b px-4 py-3.5">
            <Search className="text-muted-foreground/50 h-5 w-5" />
            <input
              autoFocus
              placeholder="Search files and folders..."
              className="text-foreground placeholder:text-muted-foreground/50 flex-1 bg-transparent text-[15px] outline-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd className="border-border/60 bg-muted text-muted-foreground/70 hidden h-6 items-center rounded border px-1.5 text-[10px] font-medium sm:inline-flex">
              ESC
            </kbd>
          </div>

          <div className="max-h-[400px] overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <div className="text-muted-foreground/70 py-8 text-center text-[13px]">
                No results found
              </div>
            ) : (
              filtered.map((item, index) => (
                <button
                  key={item.id}
                  className={cn(
                    'hover:bg-accent/60 flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150',
                    index === 0 && 'bg-accent/40'
                  )}
                  onClick={() => handleSelect(item)}
                >
                  {item.type === 'folder' ? (
                    <FolderIcon
                      className="h-[18px] w-[18px] shrink-0 text-blue-500"
                      strokeWidth={1.8}
                    />
                  ) : (
                    <File
                      className="text-muted-foreground/50 h-[18px] w-[18px] shrink-0"
                      strokeWidth={1.8}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{item.encryptedName}</p>
                    <p className="text-muted-foreground/60 text-[11px]">
                      {item.type === 'file' && formatBytes((item as FileItem).size)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="border-border/60 text-muted-foreground/60 flex items-center gap-4 border-t px-4 py-2.5 text-[11px]">
            <span className="flex items-center gap-1">
              <kbd className="border-border/60 bg-muted rounded border px-1 text-[10px]">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="border-border/60 bg-muted rounded border px-1 text-[10px]">↵</kbd>
              Select
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
