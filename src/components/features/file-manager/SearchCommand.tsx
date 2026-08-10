import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, File, Folder as FolderIcon } from 'lucide-react'
import { useUIStore } from '@stores/uiStore'
import { cn, formatBytes } from '@lib/utils'

const mockFolders = [
  { id: '1', encryptedName: 'Documents', type: 'folder' },
  { id: '2', encryptedName: 'Images', type: 'folder' },
  { id: '4', encryptedName: 'Work Projects', type: 'folder' },
]
const mockFiles = [
  { id: 'f1', encryptedName: 'Annual Report.pdf', size: 2456789, type: 'file' },
  { id: 'f2', encryptedName: 'Vacation.png', size: 4567891, type: 'file' },
  { id: 'f3', encryptedName: 'Meeting Notes.docx', size: 12345, type: 'file' },
  { id: 'f7', encryptedName: 'Readme.txt', size: 1024, type: 'file' },
]

export function SearchCommand() {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0) // Tracks which item is highlighted
  const open = useUIStore((s) => s.searchOpen)
  const setOpen = useUIStore((s) => s.setSearchOpen)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
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

  // Reset active index to 0 whenever the search query changes
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // Scroll the active item into view when navigating with arrows
  useEffect(() => {
    const activeItem = itemRefs.current[activeIndex]
    if (activeItem && listRef.current) {
      activeItem.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  const allItems = [...mockFolders, ...mockFiles]
  const filtered = query.trim()
    ? allItems.filter((item) => item.encryptedName.toLowerCase().includes(query.toLowerCase()))
    : allItems

  const handleSelect = (item: any) => {
    setOpen(false)
    if (item.type === 'folder') {
      navigate(`/vault/folder/${item.id}`)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault() // Prevent page scroll
      if (filtered.length > 0) {
        setActiveIndex((prev) => (prev + 1) % filtered.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault() // Prevent page scroll
      if (filtered.length > 0) {
        setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[activeIndex]) {
        handleSelect(filtered[activeIndex])
      }
    }
  }

  if (!open) return null

  const filteredFolders = filtered.filter((i) => i.type === 'folder')
  const filteredFiles = filtered.filter((i) => i.type === 'file')

  return (
    <div ref={containerRef} className="absolute inset-0 z-50">
      {/* Unified Container overlaying the header wrapper exactly */}
      <div className="bg-card border-border/60 absolute top-0 right-0 left-0 z-50 flex flex-col overflow-hidden rounded-lg border shadow-xl">
        {/* 1. Search Input Row */}
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

        {/* 2. Results Area */}
        <div ref={listRef} className="max-h-[320px] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <div className="text-muted-foreground/70 py-8 text-center text-[13px]">
              No results found for "{query}"
            </div>
          ) : (
            <>
              {/* Folders Section */}
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
                          strokeWidth={1.8}
                        />
                        <span className="text-foreground truncate text-[13px] font-medium">
                          {item.encryptedName}
                        </span>
                      </button>
                    )
                  })}
                </>
              )}

              {/* Separator only if both exist */}
              {filteredFolders.length > 0 && filteredFiles.length > 0 && (
                <div className="bg-border/60 my-1.5 h-px" />
              )}

              {/* Files Section */}
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
                          strokeWidth={1.8}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">{item.encryptedName}</p>
                        </div>
                        <span className="text-muted-foreground/50 text-[11px] tabular-nums">
                          {formatBytes((item as any).size)}
                        </span>
                      </button>
                    )
                  })}
                </>
              )}
            </>
          )}
        </div>

        {/* 3. Footer Keyboard Hints */}
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
