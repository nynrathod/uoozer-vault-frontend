import { useMemo, useState } from 'react'
import {
  X,
  ChevronDown,
  ChevronUp,
  File,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
} from 'lucide-react'
import { useUploadStore } from '@stores/uploadStore'
import { useUIStore } from '@stores/uiStore'
import { formatBytes } from '@lib/utils'
import { Button } from '@ui/Button'
import { Progress } from '@ui/Progress'

export function UploadQueue() {
  const [expanded, setExpanded] = useState(true)
  const uploadsMap = useUploadStore((s) => s.uploads)
  const clearCompleted = useUploadStore((s) => s.clearCompleted)
  const removeUpload = useUploadStore((s) => s.removeUpload)
  const setUploadPanelOpen = useUIStore((s) => s.setUploadPanelOpen)

  const uploads = useMemo(() => Array.from(uploadsMap.values()), [uploadsMap])

  const { activeCount, completedCount, errorCount } = useMemo(() => {
    let active = 0,
      completed = 0,
      error = 0
    uploads.forEach((u) => {
      if (u.status === 'uploading' || u.status === 'encrypting') active++
      else if (u.status === 'done') completed++
      else if (u.status === 'error') error++
    })
    return { activeCount: active, completedCount: completed, errorCount: error }
  }, [uploads])

  if (uploads.length === 0) return null

  return (
    <div className="border-border/60 bg-card fixed right-5 bottom-5 z-50 w-[380px] max-w-[calc(100vw-40px)] overflow-hidden rounded-2xl border shadow-xl">
      <div
        className="border-border/60 flex cursor-pointer items-center justify-between border-b px-4 py-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          {activeCount > 0 ? (
            <Loader2 className="text-primary h-4 w-4 animate-spin" />
          ) : errorCount > 0 ? (
            <AlertCircle className="text-destructive h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          )}
          <span className="text-[13px] font-medium">
            {activeCount > 0
              ? `${activeCount} uploading...`
              : errorCount > 0
                ? `${errorCount} failed`
                : `${completedCount} completed`}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {completedCount > 0 && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:bg-accent h-7 w-7 rounded-lg"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                clearCompleted()
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:bg-accent h-7 w-7 rounded-lg"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:bg-accent h-7 w-7 rounded-lg"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              setUploadPanelOpen(false)
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="max-h-[320px] overflow-y-auto">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="border-border/40 hover:bg-accent/30 flex items-start gap-3 border-b px-4 py-3 transition-colors last:border-b-0"
            >
              <File
                className="text-muted-foreground/50 mt-0.5 h-5 w-5 shrink-0"
                strokeWidth={1.5}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{upload.encryptedName}</p>
                <div className="mt-2 flex items-center gap-2.5">
                  <Progress
                    value={upload.overallProgress}
                    size="sm"
                    variant={
                      upload.status === 'error'
                        ? 'error'
                        : upload.status === 'done'
                          ? 'success'
                          : 'default'
                    }
                    className="flex-1"
                  />
                  <span className="text-muted-foreground/70 w-10 text-right text-[11px] tabular-nums">
                    {upload.overallProgress}%
                  </span>
                </div>
                <p className="text-muted-foreground/60 mt-1.5 text-[11px]">
                  {formatBytes(upload.totalSize)}
                  {upload.status === 'error' && (
                    <span className="text-destructive ml-2">{upload.errorMessage}</span>
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:bg-accent mt-0.5 h-6 w-6 shrink-0 rounded-md"
                onClick={() => removeUpload(upload.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
