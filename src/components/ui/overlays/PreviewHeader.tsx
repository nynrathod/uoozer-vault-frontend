import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { toast } from 'sonner'
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  Folder,
  HardDriveDownload,
  History,
  Info,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Pencil,
  Printer,
  RotateCcw,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { TOKENS } from '@config/design-tokens'
import { cn, formatBytes } from '@lib/utils'
import { Popover, PopoverTrigger, PopoverContent } from '@ui/Popover'
import { useFileStore, selectIsStarred } from '@stores/fileStore'
import { usePreviewStore } from '@stores/previewStore'
import { useItemActions } from '@hooks/useItemActions'
import { useMoveToFolder } from '@hooks/useMoveToFolder'
import { useFileUpload } from '@hooks/useFileUpload'
import { useAuthStore } from '@stores/authStore'
import { downloadFile } from '@services/files/downloadOrchestrator'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import { getCategory, getPreviewIcon } from './previewCategories'
import { useShareContext } from '@/contexts/ShareContext'
import type { FileItem } from '@/types/files'

interface PreviewHeaderProps {
  file: FileItem
  /** Extra meta from the viewer ("1920×1280" / "2 pages"). */
  detail: string | null
  canPreview: boolean
  detailsOpen: boolean
  onToggleDetails: () => void
  onOpenVersions: () => void
}

export function PreviewHeader({
  file,
  detail,
  canPreview,
  detailsOpen,
  onToggleDetails,
  onOpenVersions,
}: PreviewHeaderProps) {
  const isFullscreen = usePreviewStore((s) => s.isFullscreen)
  const isEditing = usePreviewStore((s) => s.isEditing)
  const setEditing = usePreviewStore((s) => s.setEditing)
  const setFullscreen = usePreviewStore((s) => s.setFullscreen)

  const {
    isShareMode,
    isTrash,
    copied,
    handleCopyLink,
    isGeneratingLink,
    handleDownload,
    handleDelete,
    handleRestore,
    name,
    setName,
    isSaving,
    handleSubmit,
  } = useItemActions(file, () => setEditing(false))

  // Share is disabled in favor of Copy link (public) — same swap as FileRow.
  // To re-enable: restore this selector and the Share button in the actions
  // row below, and add Share2 back to the lucide-react import list.
  // const setShareTarget = useFileStore((s) => s.setShareTarget)
  const isStarred = useFileStore(selectIsStarred(file.id))
  const toggleFileStar = useFileStore((s) => s.toggleFileStar)
  const folders = useFileStore(
    useShallow((s) =>
      Array.from(s.folders.values())
        .filter((f) => !f.deletedAt)
        .sort((a, b) => a.name.localeCompare(b.name))
    )
  )

  const { moveToFolder } = useMoveToFolder()
  const { uploadFiles } = useFileUpload()
  const shareCtx = useShareContext()
  const isSharedLink = !!shareCtx

  const [menuOpen, setMenuOpen] = useState(false)
  const [menuSub, setMenuSub] = useState<'main' | 'move'>('main')
  const [moveOpen, setMoveOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<'copy' | 'keep' | 'print' | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const category = getCategory(file.name)
  const TypeIcon = getPreviewIcon(category)

  /** "Vault / photos" breadcrumb from the file's own folder chain. */
  const location = useMemo(() => {
    const state = useFileStore.getState()
    const parts: string[] = []
    let parentId = file.folderId
    while (parentId) {
      const folder = state.folders.get(parentId)
      if (!folder) break
      parts.unshift(folder.name)
      parentId = folder.parentId
    }
    return isTrash ? 'Trash' : ['Vault', ...parts].join(' / ')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.folderId, isTrash, folders])

  const metaLine = `${location} · ${formatBytes(file.totalSize)}${detail ? ` · ${detail}` : ''}`

  const handleStar = () => {
    toggleFileStar(file.id)
    toast.success(isStarred ? 'Removed from starred' : 'Added to starred')
  }

  const handleMove = async (destinationFolderId: string | null) => {
    const key = destinationFolderId ?? 'root'
    setBusyId(key)
    const result = await moveToFolder({ item: file, isFolder: false }, destinationFolderId)
    setBusyId(null)
    setMoveOpen(false)
    setMenuOpen(false)
    setMenuSub('main')
    if (result.ok) {
      const label = destinationFolderId
        ? (folders.find((f) => f.id === destinationFolderId)?.name ?? 'folder')
        : 'Vault'
      toast.success(`Moved to ${label}`)
    } else if (result.message) {
      toast.info(result.message)
    }
  }

  const handleMakeCopy = async () => {
    if (busyAction) return
    setBusyAction('copy')
    const toastId = 'preview-copy'
    toast.loading('Decrypting and re-encrypting a copy…', { id: toastId })
    try {
      const dek = useAuthStore.getState().cryptoState.dek
      if (!dek) throw new Error('Vault is locked')
      const blob = await downloadFile({ dek, fileId: file.id })
      const dot = file.name.lastIndexOf('.')
      const copyName =
        dot > 0 ? `${file.name.slice(0, dot)} copy${file.name.slice(dot)}` : `${file.name} copy`
      await uploadFiles(
        [new File([blob], copyName, { type: file.mimeType || 'application/octet-stream' })],
        file.folderId
      )
      toast.success('Copy created', { id: toastId })
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to make a copy', { id: toastId })
    } finally {
      setBusyAction(null)
    }
  }

  const handleKeepOnDevice = async () => {
    if (busyAction) return
    setBusyAction('keep')
    const toastId = 'preview-keep'
    try {
      toast.loading('Decrypting on this device…', { id: toastId })
      const dek = useAuthStore.getState().cryptoState.dek
      if (!dek) throw new Error('Vault is locked')
      const blob = await downloadFile({ dek, fileId: file.id })
      const showSaveFilePicker = (window as any).showSaveFilePicker?.bind(window)
      if (showSaveFilePicker) {
        const handle = await showSaveFilePicker({ suggestedName: file.name })
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
        toast.success(`Kept on this device as “${file.name}”`, { id: toastId })
      } else {
        saveBlobToDisk(blob, file.name)
        toast.success('Saved to your downloads folder', { id: toastId })
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        toast.dismiss(toastId)
      } else {
        toast.error(err?.message ?? 'Failed to keep this file', { id: toastId })
      }
    } finally {
      setBusyAction(null)
    }
  }

  const handlePrint = async () => {
    if (busyAction) return
    if (isSharedLink) {
      toast.info('Printing is not available on shared links.')
      return
    }
    setBusyAction('print')
    try {
      const dek = useAuthStore.getState().cryptoState.dek
      if (!dek) throw new Error('Vault is locked')
      const blob = await downloadFile({ dek, fileId: file.id })
      if (category === 'image') {
        const url = URL.createObjectURL(blob)
        const win = window.open('', '_blank', 'width=900,height=700')
        if (!win) {
          toast.error('Allow pop-ups to print this file.')
          URL.revokeObjectURL(url)
          return
        }
        win.document.write(
          `<title>${escapeHtml(file.name)}</title>` +
            `<body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh">` +
            `<img src="${url}" alt="${escapeHtml(file.name)}" style="max-width:100%;max-height:100%">` +
            `</body>`
        )
        win.document.close()
        win.addEventListener('load', () => {
          setTimeout(() => {
            win.focus()
            win.print()
            setTimeout(() => URL.revokeObjectURL(url), 60000)
          }, 250)
        })
      } else {
        const url = URL.createObjectURL(blob)
        printInIframe(url)
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to prepare printing')
    } finally {
      setBusyAction(null)
    }
  }

  /** Sheet shortcuts owned by the header: F2 · ⌘⇧M · ⌘P · I · ⌫. */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isTyping =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (isTyping) return
      const mod = e.metaKey || e.ctrlKey
      if (e.key === 'F2' && !isShareMode && !isTrash) {
        e.preventDefault()
        setEditing(true)
      } else if (
        mod &&
        e.shiftKey &&
        (e.key === 'm' || e.key === 'M') &&
        !isShareMode &&
        !isTrash
      ) {
        e.preventDefault()
        setMenuSub('move')
        setMenuOpen(true)
      } else if (mod && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        void handlePrint()
      } else if (!mod && (e.key === 'i' || e.key === 'I') && canPreview) {
        onToggleDetails()
      } else if (e.key === 'Backspace' && !isShareMode) {
        e.preventDefault()
        setDeleteOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPreview, isShareMode, isTrash, onToggleDetails, busyAction, category, file])

  return (
    <>
      <div className="uv-preview-header">
        <TypeIcon
          className="text-ghost h-[18px] w-[18px] shrink-0"
          strokeWidth={1.6}
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          {isEditing ? (
            <div className="flex min-w-0 items-center gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => void handleSubmit()}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSubmit()
                  if (e.key === 'Escape') setEditing(false)
                }}
                className="uv-preview-rename"
                aria-label="Rename file"
              />
              {isSaving ? (
                <Loader2 className="text-ghost h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  className="text-sealed hover:bg-hover-surface shrink-0 rounded-sm p-1"
                  aria-label="Save name"
                >
                  <Check className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
                </button>
              )}
            </div>
          ) : (
            <div
              className="min-w-0"
              onDoubleClick={isShareMode || isTrash ? undefined : () => setEditing(true)}
              title={file.name}
            >
              <div className="uv-preview-name">{file.name}</div>
              <div className="uv-preview-meta">{metaLine}</div>
            </div>
          )}
        </div>

        {canPreview && (
          <button
            type="button"
            className="uv-preview-ghost"
            onClick={() => setFullscreen(!isFullscreen)}
            aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
            title={isFullscreen ? 'Exit full screen (Esc)' : 'Full screen (⌘↵)'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
            ) : (
              <Maximize2 className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
            )}
          </button>
        )}

        <Popover
          open={menuOpen}
          onOpenChange={(open) => {
            setMenuOpen(open)
            if (!open) setMenuSub('main')
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn('uv-preview-ghost', menuOpen && 'uv-preview-ghost-active')}
              aria-label="More actions"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="shadow-preview-menu rounded-xl border-0 p-1.5"
            style={{ width: TOKENS.preview.menuWidth }}
          >
            {menuSub === 'move' ? (
              <MovePickerList
                folders={folders}
                currentFolderId={file.folderId}
                busyId={busyId}
                onPick={handleMove}
                onBack={() => setMenuSub('main')}
              />
            ) : isShareMode ? (
              <MenuItem icon={Download} onClick={() => void handleDownload()}>
                Download
              </MenuItem>
            ) : isTrash ? (
              <>
                <MenuItem icon={RotateCcw} onClick={() => void handleRestore()}>
                  Restore
                </MenuItem>
                <MenuItem icon={Trash2} danger onClick={() => setDeleteOpen(true)}>
                  Delete forever
                </MenuItem>
              </>
            ) : (
              <>
                {canPreview && (
                  <MenuItem
                    icon={isFullscreen ? Minimize2 : Maximize2}
                    kbd="⌘↵"
                    onClick={() => setFullscreen(!isFullscreen)}
                  >
                    {isFullscreen ? 'Exit full screen' : 'Open full screen'}
                  </MenuItem>
                )}
                <MenuItem icon={Pencil} kbd="F2" onClick={() => setEditing(true)}>
                  Rename
                </MenuItem>
                <MenuItem icon={ArrowRight} kbd="⌘⇧M" onClick={() => setMenuSub('move')}>
                  Move to…
                </MenuItem>
                <MenuItem
                  icon={Copy}
                  disabled={busyAction === 'copy'}
                  onClick={() => void handleMakeCopy()}
                >
                  {busyAction === 'copy' ? 'Copying…' : 'Make a copy'}
                </MenuItem>
                <MenuItem
                  icon={HardDriveDownload}
                  disabled={busyAction === 'keep'}
                  onClick={() => void handleKeepOnDevice()}
                >
                  Download
                  {/* {busyAction === 'keep' ? 'Saving…' : 'Keep on this device'} */}
                </MenuItem>
                <MenuItem icon={History} onClick={onOpenVersions}>
                  Version history
                </MenuItem>
                <MenuItem
                  icon={Printer}
                  kbd="⌘P"
                  disabled={busyAction === 'print'}
                  onClick={() => void handlePrint()}
                >
                  {busyAction === 'print' ? 'Preparing…' : 'Print'}
                </MenuItem>
                {canPreview && (
                  <MenuItem icon={Info} kbd="I" onClick={onToggleDetails}>
                    Details
                  </MenuItem>
                )}
                <MenuItem icon={Trash2} kbd="⌫" danger onClick={() => setDeleteOpen(true)}>
                  Move to trash
                </MenuItem>
              </>
            )}
          </PopoverContent>
        </Popover>

        <button
          type="button"
          className="uv-preview-ghost"
          onClick={() => usePreviewStore.getState().close()}
          aria-label="Close preview"
          title="Close (Esc)"
        >
          <X className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
        </button>
      </div>

      {/* Actions row — 32 high · r8 · Download on Tint (sheet .ac) */}
      <div className="uv-preview-actions">
        <button
          type="button"
          className="uv-preview-action uv-preview-action-primary"
          onClick={() => void handleDownload()}
        >
          <Download className="h-[15px] w-[15px]" strokeWidth={1.6} aria-hidden="true" />
          Download
        </button>
        {isTrash ? (
          <button type="button" className="uv-preview-action" onClick={() => void handleRestore()}>
            <RotateCcw className="h-[15px] w-[15px]" strokeWidth={1.6} aria-hidden="true" />
            Restore
          </button>
        ) : (
          !isShareMode && (
            <>
              <button
                type="button"
                className="uv-preview-action"
                onClick={() => void handleCopyLink()}
                disabled={isGeneratingLink}
                title="Copy public link"
              >
                {copied ? (
                  <Check
                    className="text-sealed h-[15px] w-[15px] shrink-0"
                    strokeWidth={1.6}
                    aria-hidden="true"
                  />
                ) : isGeneratingLink ? (
                  <Loader2
                    className="h-[15px] w-[15px] shrink-0 animate-spin"
                    strokeWidth={1.6}
                    aria-hidden="true"
                  />
                ) : (
                  <Link2
                    className="h-[15px] w-[15px] shrink-0"
                    strokeWidth={1.6}
                    aria-hidden="true"
                  />
                )}
                {copied ? 'Copied' : 'Copy link'}
              </button>
              {/* Share disabled in favor of Copy link (public) — same swap as
                  FileRow. To re-enable: uncomment, restore the setShareTarget
                  selector above and add Share2 to the lucide-react import.
              <button
                type="button"
                className="uv-preview-action"
                onClick={() => setShareTarget(file.id)}
              >
                <Share2 className="h-[15px] w-[15px]" strokeWidth={1.6} aria-hidden="true" />
                Share
              </button> */}
              {/* <button
                type="button"
                className={cn('uv-preview-action', isStarred && 'uv-preview-action-starred')}
                onClick={handleStar}
                aria-pressed={isStarred}
              >
                <Star
                  className="h-[15px] w-[15px]"
                  strokeWidth={1.6}
                  fill={isStarred ? 'currentColor' : 'none'}
                  aria-hidden="true"
                />
                Star
              </button> */}
              <Popover open={moveOpen} onOpenChange={setMoveOpen}>
                {/* <PopoverTrigger asChild>
                  <button type="button" className="uv-preview-action" aria-label="Move file">
                    <ArrowRight
                      className="h-[15px] w-[15px]"
                      strokeWidth={1.6}
                      aria-hidden="true"
                    />
                    Move
                  </button>
                </PopoverTrigger> */}
                <PopoverContent
                  align="start"
                  sideOffset={6}
                  className="shadow-preview-menu rounded-xl border-0 p-1.5"
                  style={{ width: TOKENS.preview.menuWidth }}
                >
                  <MovePickerList
                    folders={folders}
                    currentFolderId={file.folderId}
                    busyId={busyId}
                    onPick={handleMove}
                  />
                </PopoverContent>
              </Popover>
            </>
          )
        )}
      </div>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        itemName={file.name}
        isFolder={false}
        isPermanent={isTrash}
        onConfirm={() => void handleDelete()}
      />
    </>
  )
}

/** One sheet menu row — 32 high · r6 · px 10 · 13.5 · kbd hint right. */
function MenuItem({
  icon: Icon,
  kbd,
  danger,
  disabled,
  onClick,
  children,
}: {
  icon: LucideIcon
  kbd?: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={cn('uv-preview-menu-item', danger && 'uv-preview-menu-item-danger')}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={1.6} aria-hidden="true" />
      <span className="truncate">{children}</span>
      {kbd && <span className="uv-preview-menu-kbd">{kbd}</span>}
    </button>
  )
}

/** Folder picker (sheet menu surface): Vault root + every real folder. */
function MovePickerList({
  folders,
  currentFolderId,
  busyId,
  onPick,
  onBack,
}: {
  folders: Array<{ id: string; name: string; parentId: string | null }>
  currentFolderId: string | null
  busyId: string | null
  onPick: (destinationFolderId: string | null) => void
  onBack?: () => void
}) {
  return (
    <>
      <div className="uv-preview-menu-heading flex items-center gap-1.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-ghost hover:bg-hover-surface hover:text-gray-ui -ml-1 rounded-sm px-1 py-0.5"
            aria-label="Back to actions"
          >
            <ArrowRight className="h-3 w-3 rotate-180" strokeWidth={1.6} aria-hidden="true" />
          </button>
        )}
        Move to…
      </div>
      <button
        type="button"
        className="uv-preview-menu-item"
        disabled={busyId === 'root'}
        onClick={() => onPick(null)}
      >
        {busyId === 'root' ? (
          <Loader2 className="h-[15px] w-[15px] shrink-0 animate-spin" aria-hidden="true" />
        ) : (
          <Folder className="h-[15px] w-[15px] shrink-0" strokeWidth={1.6} aria-hidden="true" />
        )}
        <span className="truncate">Vault</span>
        {currentFolderId === null && (
          <Check
            className="text-muted-foreground ml-auto h-[15px] w-[15px] shrink-0"
            strokeWidth={1.6}
            aria-hidden="true"
          />
        )}
      </button>
      {folders.map((folder) => (
        <button
          key={folder.id}
          type="button"
          className="uv-preview-menu-item"
          disabled={busyId === folder.id}
          onClick={() => onPick(folder.id)}
        >
          {busyId === folder.id ? (
            <Loader2 className="h-[15px] w-[15px] shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <Folder className="h-[15px] w-[15px] shrink-0" strokeWidth={1.6} aria-hidden="true" />
          )}
          <span className="truncate">{folder.name}</span>
          {currentFolderId === folder.id && (
            <Check
              className="text-muted-foreground ml-auto h-[15px] w-[15px] shrink-0"
              strokeWidth={1.6}
              aria-hidden="true"
            />
          )}
        </button>
      ))}
      {folders.length === 0 && <div className="uv-preview-menu-heading">No folders yet</div>}
    </>
  )
}

/** Saves a decrypted blob to disk (fallback for non-File-System-Access browsers). */
function saveBlobToDisk(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Prints a blob URL inside a hidden iframe (PDFs and other renderable types). */
function printInIframe(url: string) {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.src = url
  iframe.addEventListener('load', () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  })
  document.body.appendChild(iframe)
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  )
}
