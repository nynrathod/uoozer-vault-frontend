import {
  ArrowUpDown,
  Plus,
  FolderPlus,
  Upload,
  FileText,
  Presentation,
  FileSpreadsheet,
  List,
  LayoutGrid,
  Download,
  Trash2,
  X,
  Check,
  ChevronDown,
} from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useFileStore } from '@stores/fileStore'
import { useUIStore } from '@stores/uiStore'
import { Button } from '@ui/Button'
import { DropdownMenu, DropdownItem, DropdownSeparator, DropdownLabel } from '@ui/DropdownMenu'

// Item 35: Module-level constants for icons
const NEW_FOLDER_ICON = <FolderPlus className="h-4 w-4" />
const UPLOAD_ICON = <Upload className="h-4 w-4" />
const NEW_DOC_ICON = <FileText className="h-4 w-4" />
const NEW_PPT_ICON = <Presentation className="h-4 w-4" />
const NEW_XLS_ICON = <FileSpreadsheet className="h-4 w-4" />

export function VaultToolbar() {
  const files = useFileStore((s) => s.files)
  const folders = useFileStore((s) => s.folders)
  const selectedFileIds = useFileStore((s) => s.selectedFileIds)
  const clearFileSelection = useFileStore((s) => s.clearSelection)
  const deleteItem = useFileStore((s) => s.deleteItem)

  const sortField = useFileStore((s) => s.sortField)
  const sortOrder = useFileStore((s) => s.sortOrder)
  const setSort = useFileStore((s) => s.setSort)
  const viewMode = useFileStore((s) => s.viewMode)
  const toggleViewMode = useFileStore((s) => s.toggleViewMode)
  const setEditingId = useFileStore((s) => s.setEditingId)
  const setUploadPanelOpen = useUIStore((s) => s.setUploadPanelOpen)

  const hasSelection = selectedFileIds.size > 0

  // Item 33: useMemo for computed values
  const itemCount = useMemo(() => files.size + folders.size, [files, folders])

  // Item 34: useCallback for event handlers
  const handleBulkDelete = useCallback(() => {
    selectedFileIds.forEach((id) => deleteItem(id, folders.has(id)))
    clearFileSelection()
  }, [selectedFileIds, deleteItem, folders, clearFileSelection])

  const handleNewFolder = useCallback(() => setEditingId('new'), [setEditingId])
  const handleUploadClick = useCallback(() => setUploadPanelOpen(true), [setUploadPanelOpen])

  return (
    <div className="border-border/60 flex shrink-0 items-center justify-between border-b px-4 py-2">
      {hasSelection ? (
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 rounded-lg"
              onClick={clearFileSelection}
            >
              <X className="h-4 w-4" />
            </Button>
            <span className="text-[13px] font-medium">{selectedFileIds.size} selected</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg text-[13px]">
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 h-8 gap-1.5 rounded-lg text-[13px]"
              onClick={handleBulkDelete}
            >
              <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Delete</span>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <DropdownMenu
              align="start"
              trigger={
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg text-[13px]">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sort</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              }
            >
              <DropdownLabel>Sort by</DropdownLabel>
              <DropdownItem onClick={() => setSort('name', 'asc')}>
                Name (A → Z){' '}
                {sortField === 'name' && sortOrder === 'asc' && (
                  <Check className="ml-auto h-3.5 w-3.5" />
                )}
              </DropdownItem>
              <DropdownItem onClick={() => setSort('name', 'desc')}>
                Name (Z → A){' '}
                {sortField === 'name' && sortOrder === 'desc' && (
                  <Check className="ml-auto h-3.5 w-3.5" />
                )}
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem onClick={() => setSort('modified', 'desc')}>
                Newest first{' '}
                {sortField === 'modified' && sortOrder === 'desc' && (
                  <Check className="ml-auto h-3.5 w-3.5" />
                )}
              </DropdownItem>
              <DropdownItem onClick={() => setSort('modified', 'asc')}>
                Oldest first{' '}
                {sortField === 'modified' && sortOrder === 'asc' && (
                  <Check className="ml-auto h-3.5 w-3.5" />
                )}
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem onClick={() => setSort('size', 'desc')}>
                Largest first{' '}
                {sortField === 'size' && sortOrder === 'desc' && (
                  <Check className="ml-auto h-3.5 w-3.5" />
                )}
              </DropdownItem>
              <DropdownItem onClick={() => setSort('size', 'asc')}>
                Smallest first{' '}
                {sortField === 'size' && sortOrder === 'asc' && (
                  <Check className="ml-auto h-3.5 w-3.5" />
                )}
              </DropdownItem>
            </DropdownMenu>
            <span className="text-muted-foreground/60 hidden text-xs sm:inline">
              {itemCount} items
            </span>
          </div>

          <div className="flex items-center gap-1">
            <DropdownMenu
              trigger={
                <Button
                  variant="default"
                  size="sm"
                  className="bg-foreground text-background hover:bg-foreground/90 h-8 gap-1.5 rounded-lg px-3 text-[13px] font-medium"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} /> New
                </Button>
              }
            >
              <DropdownItem icon={NEW_FOLDER_ICON} onClick={handleNewFolder}>
                New Folder
              </DropdownItem>
              <DropdownItem icon={UPLOAD_ICON} onClick={handleUploadClick}>
                Upload File
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem icon={NEW_DOC_ICON}>New Document</DropdownItem>
              <DropdownItem icon={NEW_PPT_ICON}>New Presentation</DropdownItem>
              <DropdownItem icon={NEW_XLS_ICON}>New Spreadsheet</DropdownItem>
            </DropdownMenu>
            <div className="bg-border/70 mx-1 hidden h-5 w-px sm:block" />
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => viewMode !== 'list' && toggleViewMode()}
              className="hidden h-8 w-8 rounded-lg sm:flex"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => viewMode !== 'grid' && toggleViewMode()}
              className="hidden h-8 w-8 rounded-lg sm:flex"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
