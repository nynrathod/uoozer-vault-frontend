import { useEffect, useState } from 'react'
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
  Calendar,
  HardDrive,
  User,
  History,
  Check,
} from 'lucide-react'
import { cn, formatBytes, formatRelativeDate } from '@lib/utils'
import { useClipboard } from '@hooks/useClipboard'
import { useInlineRename } from '@hooks/useInlineRename'
import { MOCK_URLS, UI_CONFIG } from '@lib/constants'
import type { FileItem } from '@/types/files'

interface FilePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: FileItem | null
  isFullscreen: boolean
  setIsFullscreen: (val: boolean) => void
  onRename?: (id: string, isFolder: boolean, newName: string) => void
  onDelete?: (id: string, isFolder: boolean) => void
  onShare: (file: FileItem) => void
}

export function FilePreviewDialog({
  open,
  onOpenChange,
  file,
  isFullscreen,
  setIsFullscreen,
  onRename,
  onDelete,
  onShare,
}: FilePreviewDialogProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)

  const { copied, copy } = useClipboard()
  const {
    name: previewName,
    setName,
    isSaving,
    handleSubmit,
  } = useInlineRename(
    file?.encryptedName || '',
    (newName) => {
      if (file && onRename) onRename(file.id, false, newName)
      setIsEditing(false)
    },
    () => setIsEditing(false)
  )

  useEffect(() => {
    if (open) {
      setIsLoading(true)
      setIsEditing(false)
      const timer = setTimeout(() => setIsLoading(false), UI_CONFIG.PREVIEW_LOAD_DELAY_MS)
      return () => clearTimeout(timer)
    }
  }, [open, file])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        if (isEditing) setIsEditing(false)
        else onOpenChange(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange, isEditing])

  if (!open || !file) return null

  const isImage = file.encryptedMimeType?.startsWith('image/')
  const isPdf = file.encryptedMimeType === 'application/pdf'
  const isText =
    file.encryptedMimeType?.startsWith('text/') || file.encryptedMimeType === 'application/document'

  const handleCopyLink = () => copy(`${MOCK_URLS.SHARE_LINK_BASE}${file.id}`)

  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-[150] flex flex-col bg-[#0a0a0a]/95 backdrop-blur-xl animate-fade-in'
    : 'flex flex-col h-full w-full bg-background animate-fade-in'
  const headerClasses = isFullscreen
    ? 'h-16 flex items-center justify-between px-4 border-b border-white/10 text-white shrink-0 bg-[#0a0a0a]'
    : 'h-16 flex items-center justify-between px-4 border-b border-border text-foreground shrink-0 bg-background'
  const iconBtnClasses = isFullscreen
    ? 'text-white/60 hover:bg-white/10 hover:text-white'
    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
  const contentAreaClasses = isFullscreen
    ? 'flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden relative bg-[#0a0a0a]'
    : 'flex-1 flex items-center justify-center p-4 md:p-6 overflow-hidden relative bg-muted/40'

  return (
    <div className={containerClasses}>
      <div className={headerClasses}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {!isFullscreen && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(iconBtnClasses, 'shrink-0 md:hidden')}
              onClick={() => onOpenChange(false)}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          {isFullscreen && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(iconBtnClasses, 'shrink-0')}
              onClick={() => setIsFullscreen(false)}
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
                      if (e.key === 'Escape') setIsEditing(false)
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
                <div className="min-w-0" onDoubleClick={() => setIsEditing(true)}>
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
            onClick={() => onShare(file)}
          >
            <Share2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(iconBtnClasses, 'hidden h-9 gap-1.5 px-3 font-medium md:flex')}
            onClick={() => onShare(file)}
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
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </Button>

          <FileActionsMenu
            item={file}
            isFolder={false}
            onRenameRequest={() => setIsEditing(true)}
            onDelete={onDelete || (() => {})}
            onShare={() => onShare(file)}
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
                onClick={() => onOpenChange(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className={contentAreaClasses}>
        {isLoading && (
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              isFullscreen ? 'bg-[#0a0a0a]' : 'bg-muted/30'
            )}
          >
            <Loader2
              className={cn(
                'h-8 w-8 animate-spin',
                isFullscreen ? 'text-white/50' : 'text-muted-foreground'
              )}
            />
          </div>
        )}

        <div
          className={cn(
            'bg-card border-border/50 flex h-full max-h-full w-full max-w-full flex-col items-center justify-center overflow-hidden rounded-xl border shadow-lg',
            isFullscreen && 'max-h-[85vh] max-w-5xl'
          )}
        >
          {isImage && (
            <img
              src={MOCK_URLS.UNSPLASH_IMAGE}
              alt={file.encryptedName}
              className={cn(
                'max-h-full max-w-full object-contain transition-opacity duration-300',
                isLoading ? 'opacity-0' : 'opacity-100'
              )}
              onLoad={() => setIsLoading(false)}
            />
          )}
          {isPdf && (
            <object
              data={`${MOCK_URLS.DUMMY_PDF}#toolbar=1&navpanes=0`}
              type="application/pdf"
              className={cn(
                'h-full w-full transition-opacity duration-300',
                isLoading ? 'opacity-0' : 'opacity-100'
              )}
            >
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <p className="text-muted-foreground mb-4">
                  Your browser does not support inline PDFs.
                </p>
                <a
                  href={MOCK_URLS.DUMMY_PDF}
                  download
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                >
                  Download PDF
                </a>
              </div>
            </object>
          )}
          {isText && (
            <div
              className={cn(
                'h-full w-full overflow-y-auto p-6 text-left transition-opacity duration-300 md:p-8',
                isLoading ? 'opacity-0' : 'opacity-100'
              )}
            >
              <h1 className="mb-6 text-xl font-bold text-neutral-900 md:text-2xl">
                {file.encryptedName}
              </h1>
              <div className="prose prose-sm max-w-none space-y-4 leading-relaxed text-neutral-600">
                <p>
                  This is a simulated text preview for <strong>{file.encryptedName}</strong>. In a
                  production zero-knowledge environment, the actual file content would be fetched in
                  encrypted chunks from the server, decrypted client-side using your Master Key, and
                  rendered securely here in the DOM.
                </p>
              </div>
            </div>
          )}
          {!isImage && !isPdf && !isText && (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div
                className={cn(
                  'mb-5 flex h-20 w-20 items-center justify-center rounded-2xl',
                  isFullscreen ? 'bg-white/10' : 'bg-secondary'
                )}
              >
                <FileIcon
                  mimeType={file.encryptedMimeType}
                  size="lg"
                  className={cn(
                    'bg-transparent',
                    isFullscreen ? 'text-white/50' : 'text-muted-foreground'
                  )}
                />
              </div>
              <h3
                className={cn(
                  'mb-1 text-lg font-semibold',
                  isFullscreen ? 'text-white' : 'text-foreground'
                )}
              >
                No preview available
              </h3>
              <p
                className={cn(
                  'mb-6 max-w-sm text-sm',
                  isFullscreen ? 'text-white/50' : 'text-muted-foreground'
                )}
              >
                We can't show a preview for this file type in your browser. Please download it to
                view its contents.
              </p>
              <Button variant="secondary" className="gap-1.5">
                <Download className="h-4 w-4" /> Download file
              </Button>
            </div>
          )}
        </div>
      </div>

      {!isFullscreen && (
        <div className="border-border bg-background h-auto shrink-0 space-y-3 border-t p-4">
          <h4 className="text-muted-foreground/60 text-[11px] font-semibold tracking-wider uppercase">
            File information
          </h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12px]">
            <div className="text-muted-foreground flex items-center gap-2">
              <HardDrive className="h-3.5 w-3.5" /> Size{' '}
              <span className="text-foreground ml-auto font-medium">{formatBytes(file.size)}</span>
            </div>
            <div className="text-muted-foreground flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" /> Modified{' '}
              <span className="text-foreground ml-auto font-medium">
                {formatRelativeDate(file.updatedAt)}
              </span>
            </div>
            <div className="text-muted-foreground flex items-center gap-2">
              <User className="h-3.5 w-3.5" /> Owner{' '}
              <span className="text-foreground ml-auto font-medium">You</span>
            </div>
            <div className="text-muted-foreground flex items-center gap-2">
              <History className="h-3.5 w-3.5" /> Version{' '}
              <span className="text-foreground ml-auto font-medium">v{file.version}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
