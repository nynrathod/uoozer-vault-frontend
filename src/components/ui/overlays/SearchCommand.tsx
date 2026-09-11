import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, generatePath } from 'react-router-dom'
import { Search, File, Folder as FolderIcon, Loader2, Clock, Sparkles } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useUIStore } from '@stores/uiStore'
import { usePreviewStore } from '@stores/previewStore'
import {
  useVaultSearch,
  seedStoreFromSearchItem,
  breadcrumbFromIndex,
  recordRecentItem,
  getRecentItems,
  type VaultSearchItem,
} from '@hooks/useVaultSearch'
import { useKeyboardNavigation } from '@hooks/useKeyboardNavigation'
import { cn, formatBytes } from '@lib/utils'
import { ROUTES } from '@lib/constants'

export function SearchCommand() {
  const [query, setQuery] = useState('')
  const open = useUIStore((s) => s.searchOpen)
  const setOpen = useUIStore((s) => s.setSearchOpen)
  const navigate = useNavigate()
  const openPreview = usePreviewStore((s) => s.open)
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { items: allItems, isLoading } = useVaultSearch()

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

  const openCount = useRef(0)
  useEffect(() => {
    if (open) openCount.current += 1
  }, [open])

  const suggestions = useMemo<{
    items: VaultSearchItem[]
    label: string
    icon: 'recent' | 'suggested'
  }>(() => {
    const recents = getRecentItems(allItems)
    if (recents.length > 0) return { items: recents, label: 'Recent', icon: 'recent' }
    if (allItems.length === 0) return { items: [] as VaultSearchItem[], label: '', icon: 'recent' }
    const seed = openCount.current
    const shuffled = [...allItems]
      .map((item, i) => ({ item, k: ((i + 1) * (seed + 7) * 2654435761) % 100003 }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.item)
      .slice(0, 6)
    return { items: shuffled, label: 'Suggested', icon: 'suggested' }
  }, [allItems, open])

  const filtered = useMemo(() => {
    if (!query.trim()) return suggestions.items
    const q = query.toLowerCase()
    return allItems.filter((item) => item.name.toLowerCase().includes(q)).slice(0, 50)
  }, [query, allItems, suggestions])

  const handleSelect = (item: VaultSearchItem) => {
    setOpen(false)
    recordRecentItem(item)
    if (item.type === 'folder') {
      seedStoreFromSearchItem(item)
      const chain = breadcrumbFromIndex(allItems, item.id)
      if (chain.length > 0) {
        queryClient.setQueryData(
          ['breadcrumb', item.id],
          chain.map((c) => ({
            id: c.id,
            uid: c.id,
            parentId: null,
            name: c.name,
            encryptedMetadata: '',
            metadataNonce: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }))
        )
      }
      navigate(generatePath(ROUTES.VAULT_FOLDER, { folderId: item.id }))
    } else {
      seedStoreFromSearchItem(item)
      openPreview(item.id)
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
  const isSuggestionMode = !query.trim()
  const HeaderIcon = suggestions.icon === 'recent' ? Clock : Sparkles

  const renderRow = (item: VaultSearchItem) => {
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
        {item.type === 'folder' ? (
          <FolderIcon className="h-[18px] w-[18px] shrink-0 text-blue-500" strokeWidth={1.75} />
        ) : (
          <File
            className="text-muted-foreground/50 h-[18px] w-[18px] shrink-0"
            strokeWidth={1.75}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{item.name}</p>
        </div>
        <span className="text-muted-foreground/50 text-[11px] tabular-nums">
          {formatBytes(item.size ?? 0)}
        </span>
      </button>
    )
  }

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
          {isLoading ? (
            <div className="text-muted-foreground/60 flex items-center justify-center gap-2 py-8 text-[13px]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Indexing your vault...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-muted-foreground/70 py-8 text-center text-[13px]">
              {isSuggestionMode && allItems.length === 0
                ? 'Your vault is empty — upload files to get started'
                : isSuggestionMode
                  ? 'Start typing to search your vault'
                  : `No results found for "${query}"`}
            </div>
          ) : (
            <>
              {isSuggestionMode && suggestions.label && (
                <div className="text-muted-foreground/50 flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
                  <HeaderIcon className="h-3 w-3" />
                  {suggestions.label}
                </div>
              )}
              {filteredFolders.length > 0 && !isSuggestionMode && (
                <div className="text-muted-foreground/50 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
                  Folders
                </div>
              )}
              {filteredFolders.map(renderRow)}
              {filteredFolders.length > 0 && filteredFiles.length > 0 && !isSuggestionMode && (
                <div className="bg-border/60 my-1.5 h-px" />
              )}
              {filteredFiles.length > 0 && !isSuggestionMode && (
                <div className="text-muted-foreground/50 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
                  Files
                </div>
              )}
              {filteredFiles.map(renderRow)}
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
