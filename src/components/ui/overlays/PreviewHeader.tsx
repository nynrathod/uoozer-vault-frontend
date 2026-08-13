import { Button } from '@ui/Button'
import { FileIcon } from '@/components/features/vault/file-list/FileIcon'
import { FileActionsMenu } from '@/components/features/vault/file-actions/FileActionsMenu'
import {
  X,
  Download,
  Share2,
  ChevronLeft,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Check,
} from 'lucide-react'
import { cn, formatBytes } from '@lib/utils'
import { useClipboard } from '@hooks/useClipboard'
import { useInlineRename } from '@hooks/useInlineRename'
import { useFileStore, selectFileById } from '@stores/fileStore'
import { usePreviewStore } from '@stores/previewStore'
import { MOCK_URLS } from '@lib/constants'

export function PreviewHeader() {
  const fileId = usePreviewStore((s) => s.fileId)
  const isFullscreen = usePreviewStore((s) => s.isFullscreen)
  const isEditing = usePreviewStore((s) => s.isEditing)
  const setFullscreen = usePreviewStore((s) => s.setFullscreen)
  const setEditing = usePreviewStore((s) => s.setEditing)
  const close = usePreviewStore((s) => s.close)

  const file = useFileStore(selectFileById(fileId))
  const renameItem = useFileStore((s) => s.renameItem)
  const deleteItem = useFileStore((s) => s.deleteItem)
  const setShareTarget = useFileStore((s) => s.setShareTarget)

  const { copied, copy } = useClipboard()
  const {
    name: previewName,
    setName,
    isSaving,
    handleSubmit,
  } = useInlineRename(
    file?.encryptedName ?? '',
    (newName) => {
      if (file) renameItem(file.id, false, newName)
      setEditing(false)
    },
    () => setEditing(false)
  )

  if (!file) return null

  const handleCopyLink = () => copy(`${MOCK_URLS.SHARE_LINK_BASE}${file.id}`)

  const headerClasses = isFullscreen
    ? 'h-16 flex items-center justify-between px-4 border-b border-white/10 text-white shrink-0 bg-[#0a0a0a]'
    : 'h-16 flex items-center justify-between px-4 border-b border-border text-foreground shrink-0 bg-background'
  const iconBtnClasses = isFullscreen
    ? 'text-white/60 hover:bg-white/10 hover:text-white'
    : 'text-muted-foreground hover:bg-accent hover:text-foreground'

  return (
    <div className={headerClasses}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {!isFullscreen && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(iconBtnClasses, 'shrink-0 md:hidden')}
            onClick={close}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        {isFullscreen && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(iconBtnClasses, 'shrink-0')}
            onClick={() => setFullscreen(false)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}

        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              isFullscreen ? 'bg-white/10' : 'bg-secondary'
            )}
          >
            <FileIcon
              mimeType={file.encryptedMimeType}
              size="sm"
              className={cn(
                'bg-transparent',
                isFullscreen ? 'text-white/80' : 'text-muted-foreground'
              )}
            />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {isEditing ? (
              <>
                <input
                  autoFocus
                  value={previewName}
                  onChange={(e) => setName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit()
                    if (e.key === 'Escape') setEditing(false)
                  }}
                  className={cn(
                    'bg-background border-primary w-full max-w-[300px] rounded-md border px-1.5 py-0.5 text-sm font-semibold outline-none',
                    isFullscreen && 'border-white/20 bg-white/10 text-white'
                  )}
                />
                {isSaving ? (
                  <Loader2 className="text-primary h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <button
                    onClick={handleSubmit}
                    className="shrink-0 text-emerald-500 hover:text-emerald-600"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </>
            ) : (
              <div className="min-w-0" onDoubleClick={() => setEditing(true)}>
                <p className="cursor-pointer truncate text-sm font-semibold">
                  {file.encryptedName}
                </p>
                <p
                  className={cn(
                    'truncate text-xs',
                    isFullscreen ? 'text-white/40' : 'text-muted-foreground/60'
                  )}
                >
                  {file.encryptedMimeType?.replace('application/', '').toUpperCase()} •{' '}
                  {formatBytes(file.size)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className={cn(iconBtnClasses, 'h-9 w-9 md:hidden')}
          onClick={() => setShareTarget(file.id)}
        >
          <Share2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(iconBtnClasses, 'hidden h-9 gap-1.5 px-3 font-medium md:flex')}
          onClick={() => setShareTarget(file.id)}
        >
          <Share2 className="h-4 w-4" /> Share
        </Button>

        <Button variant="ghost" size="icon" className={cn(iconBtnClasses, 'h-9 w-9 md:hidden')}>
          <Download className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(iconBtnClasses, 'hidden h-9 gap-1.5 px-3 font-medium md:flex')}
        >
          <Download className="h-4 w-4" /> Download
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className={cn(iconBtnClasses, 'h-9 w-9')}
          onClick={() => setFullscreen(!isFullscreen)}
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </Button>

        <FileActionsMenu
          item={file}
          isFolder={false}
          onRenameRequest={() => setEditing(true)}
          onDelete={deleteItem}
          onShare={() => setShareTarget(file.id)}
          copied={copied}
          onCopyLink={handleCopyLink}
          trigger={
            <Button variant="ghost" size="icon" className={cn(iconBtnClasses, 'h-9 w-9')}>
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          }
        />

        {!isFullscreen && (
          <>
            <div className={cn('bg-border/60 mx-1 hidden h-5 w-px md:block')} />
            <Button
              variant="ghost"
              size="icon"
              className={cn(iconBtnClasses, 'hidden h-9 w-9 md:flex')}
              onClick={close}
            >
              <X className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
