import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, File, Folder as FolderIcon } from 'lucide-react'
import { useUIStore } from '@stores/uiStore'
import { useFileStore } from '@stores/fileStore'
import { useShallow } from 'zustand/react/shallow'
import { useKeyboardNavigation } from '@hooks/useKeyboardNavigation'
import { cn, formatBytes } from '@lib/utils'

/** Shape of a file or folder entry used in search results. */
interface SearchableItem {
  id: string
  name: string
  type: 'file' | 'folder'
  size?: number
}

/** Command-palette-style search overlay for files and folders with keyboard navigation. */
export function SearchCommand() {
  const [query, setQuery] = useState('')
  const open = useUIStore((s) => s.searchOpen)
  const setOpen = useUIStore((s) => s.setSearchOpen)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const files = useFileStore(useShallow((s) => Array.from(s.files.values())))
  const folders = useFileStore(useShallow((s) => Array.from(s.folders.values())))

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, setOpen])

  const allItems = useMemo<SearchableItem[]>(() => {
    const folderItems = folders.map((f) => ({
      id: f.id,
      name: f.name,
      type: 'folder' as const,
    }))
    const fileItems = files.map((f) => ({
      id: f.id,
      name: f.name,
      type: 'file' as const,
      size: f.totalSize,
    }))
    return [...folderItems, ...fileItems]
  }, [files, folders])

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems
    return allItems.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
  }, [query, allItems])

  const handleSelect = (item: SearchableItem) => {
    setOpen(false)
    if (item.type === 'folder') {
      navigate(`/vault/folder/${item.id}`)
    }
  }

  const { activeIndex, setActiveIndex, itemRefs, listRef, handleKeyDown } = useKeyboardNavigation({
    items: filtered,
    onSelect: handleSelect,
    open,
    setOpen,
  })

  if (!open) return null

  const filteredFolders = filtered.filter((i) => i.type === 'folder')
  const filteredFiles = filtered.filter((i) => i.type === 'file')

  return (
    <div ref={containerRef} className="absolute inset-0 z-50">
      <div className="bg-card border-border/60 absolute top-0 right-0 left-0 z-50 flex flex-col overflow-hidden rounded-lg border shadow-xl">
        <div className="border-border/60 flex h-10 shrink-0 items-center gap-2.5 border-b px-3.5">
          <Search className="text-muted-foreground/60 h-4 w-4 shrink-0" />
          <input
            ref={inputRef}
            onKeyDown={handleKeyDown}
            placeholder="Search files and folders..."
            className="text-foreground placeholder:text-muted-foreground/70 flex-1 bg-transparent text-sm outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="border-border/70 bg-muted text-muted-foreground/50 hidden h-[22px] items-center rounded border px-1.5 text-[11px] font-medium shadow-sm sm:inline-flex">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[320px] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <div className="text-muted-foreground/70 py-8 text-center text-[13px]">
              No results found for "{query}"
            </div>
          ) : (
            <>
              {filteredFolders.length > 0 && (
                <>
                  <div className="text-muted-foreground/50 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
                    Folders
                  </div>
                  {filteredFolders.map((item) => {
                    const itemIndex = filtered.indexOf(item)
                    return (
                      <button
                        key={item.id}
                        ref={(el) => {
                          itemRefs.current[itemIndex] = el
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                          itemIndex === activeIndex ? 'bg-accent/60' : 'hover:bg-accent/60'
                        )}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                      >
                        <FolderIcon
                          className="h-[18px] w-[18px] shrink-0 text-blue-500"
                          strokeWidth={1.75}
                        />
                        <span className="text-foreground truncate text-[13px] font-medium">
                          {item.name}
                        </span>
                      </button>
                    )
                  })}
                </>
              )}

              {filteredFolders.length > 0 && filteredFiles.length > 0 && (
                <div className="bg-border/60 my-1.5 h-px" />
              )}

              {filteredFiles.length > 0 && (
                <>
                  <div className="text-muted-foreground/50 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
                    Files
                  </div>
                  {filteredFiles.map((item) => {
                    const itemIndex = filtered.indexOf(item)
                    return (
                      <button
                        key={item.id}
                        ref={(el) => {
                          itemRefs.current[itemIndex] = el
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                          itemIndex === activeIndex ? 'bg-accent/60' : 'hover:bg-accent/60'
                        )}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                      >
                        <File
                          className="text-muted-foreground/50 h-[18px] w-[18px] shrink-0"
                          strokeWidth={1.75}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">{item.name}</p>
                        </div>
                        <span className="text-muted-foreground/50 text-[11px] tabular-nums">
                          {formatBytes(item.size ?? 0)}
                        </span>
                      </button>
                    )
                  })}
                </>
              )}
            </>
          )}
        </div>

        <div className="border-border/60 text-muted-foreground/60 flex items-center gap-4 border-t px-4 py-2 text-[11px]">
          <span className="flex items-center gap-1">
            <kbd className="border-border/60 bg-muted rounded border px-1 text-[10px]">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="border-border/60 bg-muted rounded border px-1 text-[10px]">↵</kbd>
            Open
          </span>
          <span className="ml-auto flex items-center gap-1">
            <kbd className="border-border/60 bg-muted rounded border px-1 text-[10px]">Esc</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  )
}
