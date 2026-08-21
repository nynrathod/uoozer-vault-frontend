import { useMemo, useState } from 'react'
import {
  X,
  ChevronDown,
  ChevronUp,
  File,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Upload,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react'
import { useUploadStore } from '@stores/uploadStore'
import { cn } from '@lib/utils'
import { Button } from '@ui/Button'
import { Tabs, TabsList, TabsTrigger } from '@ui/Tabs'
import { useClipboard } from '@hooks/useClipboard'
import { useUploadManager } from '@hooks/useUploadManager'
import { MOCK_URLS } from '@lib/constants'
import type { UploadFile } from '@/types/upload'

type TabId = 'all' | 'completed' | 'failed'

function getStatusText(status: UploadFile['status']): string {
  switch (status) {
    case 'queued':
      return 'Waiting...'
    case 'encrypting':
      return 'Encrypting...'
    case 'uploading':
      return 'Uploading...'
    case 'completing':
      return 'Finalizing...'
    case 'done':
      return 'Done'
    case 'error':
      return 'Failed'
    case 'cancelled':
      return 'Cancelled'
    case 'paused':
      return 'Paused'
    default:
      return ''
  }
}

function UploadRow({ upload }: { upload: UploadFile }) {
  const { copied, copy } = useClipboard()
  const { pauseUpload, resumeUpload, cancelUpload, retryUpload } = useUploadManager()

  const isDone = upload.status === 'done'
  const isError = upload.status === 'error' || upload.status === 'cancelled'
  const isPaused = upload.status === 'paused'
  const isActive = !isDone && !isError && !isPaused

  return (
    <div className="border-border/40 hover:bg-accent/30 group flex items-start gap-3 rounded-lg border p-2.5 transition-colors">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        {isActive ? (
          <Loader2 className="text-primary h-4 w-4 animate-spin" />
        ) : isDone ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : isError ? (
          <AlertCircle className="text-destructive h-4 w-4" />
        ) : (
          <Pause className="text-muted-foreground h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[13px] font-medium">{upload.file.name}</p>
          <span
            className={cn(
              'shrink-0 text-[11px] font-medium',
              isDone
                ? 'text-emerald-500'
                : isError
                  ? 'text-destructive'
                  : isPaused
                    ? 'text-amber-500'
                    : 'text-muted-foreground'
            )}
          >
            {isDone ? 'Done' : isError ? 'Failed' : getStatusText(upload.status)}
          </span>
        </div>

        <div className="bg-primary/20 relative mt-2 h-1.5 w-full overflow-hidden rounded-full">
          {isActive ? (
            <div
              className="bg-primary absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${upload.overallProgress}%`, transition: 'width 300ms ease-out' }}
            />
          ) : (
            <div
              className={cn(
                'absolute inset-y-0 left-0 rounded-full transition-all duration-300',
                isError ? 'bg-destructive' : 'bg-emerald-500'
              )}
              style={{ width: `${upload.overallProgress}%` }}
            />
          )}
        </div>

        {isError && upload.errorMessage && (
          <p className="text-destructive mt-1 text-[11px]">{upload.errorMessage}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {isActive && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 rounded-md"
            onClick={() => pauseUpload(upload.id)}
            title="Pause"
          >
            <Pause className="h-3.5 w-3.5" />
          </Button>
        )}
        {isPaused && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 rounded-md"
            onClick={() => resumeUpload(upload.id)}
            title="Resume"
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
        )}
        {isError && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 rounded-md"
            onClick={() => retryUpload(upload.id)}
            title="Retry"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
        {!isDone && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-6 w-6 rounded-md"
            onClick={() =>
              cancelUpload(upload.id, upload.fileId || undefined, upload.versionId || undefined)
            }
            title="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        {isDone && upload.fileId && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:bg-accent hover:text-primary h-6 w-6 rounded-md"
            onClick={() => copy(`${MOCK_URLS.SHARE_LINK_BASE}${upload.fileId}`)}
            title="Copy link"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

export function UploadQueue() {
  const uploadsMap = useUploadStore((s) => s.uploads)
  const clearCompleted = useUploadStore((s) => s.clearCompleted)
  const pauseUpload = useUploadStore((s) => s.pauseUpload)
  const resumeUpload = useUploadStore((s) => s.resumeUpload)
  const retryUpload = useUploadStore((s) => s.retryUpload)

  const [isMinimized, setIsMinimized] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('all')

  const uploads = useMemo(() => Array.from(uploadsMap.values()).reverse(), [uploadsMap])

  const { active, completed, failed } = useMemo(() => {
    return uploads.reduce(
      (acc, u) => {
        if (
          u.status === 'uploading' ||
          u.status === 'encrypting' ||
          u.status === 'queued' ||
          u.status === 'completing'
        ) {
          acc.active.push(u)
        } else if (u.status === 'done') {
          acc.completed.push(u)
        } else if (u.status === 'error' || u.status === 'cancelled' || u.status === 'paused') {
          acc.failed.push(u)
        }
        return acc
      },
      {
        active: [] as typeof uploads,
        completed: [] as typeof uploads,
        failed: [] as typeof uploads,
      }
    )
  }, [uploads])

  if (uploads.length === 0) return null

  const currentItems =
    activeTab === 'all' ? uploads : activeTab === 'completed' ? completed : failed

  const tabs = [
    { id: 'all' as const, label: 'All', count: uploads.length },
    { id: 'completed' as const, label: 'Completed', count: completed.length },
    { id: 'failed' as const, label: 'Failed', count: failed.length },
  ]
  const currentProcessingIndex = completed.length + active.length

  return (
    <div className="border-border/60 bg-card fixed right-5 bottom-5 z-50 w-[380px] max-w-[calc(100vw-40px)] overflow-hidden rounded-2xl border shadow-2xl shadow-black/10 transition-all duration-300 ease-out dark:shadow-black/40">
      <div
        className="border-border/60 flex cursor-pointer items-center justify-between border-b px-4 py-3"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-2.5">
          {active.length > 0 ? (
            <Loader2 className="text-primary h-4 w-4 animate-spin" />
          ) : failed.length > 0 ? (
            <AlertCircle className="text-destructive h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          )}
          <span className="text-[13px] font-semibold">
            {active.length > 0
              ? `Uploading ${currentProcessingIndex} of ${uploads.length} items...`
              : failed.length > 0
                ? `${failed.length} upload${failed.length !== 1 ? 's' : ''} failed`
                : `${completed.length} upload${completed.length !== 1 ? 's' : ''} complete`}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:bg-accent h-7 w-7 rounded-lg"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              setIsMinimized(!isMinimized)
            }}
          >
            {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {completed.length > 0 && active.length === 0 && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:bg-accent hover:text-destructive h-7 w-7 rounded-lg"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                clearCompleted()
              }}
              title="Clear completed"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {!isMinimized && (
        <div className="flex flex-col">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabId)}
            className="w-full"
          >
            <TabsList className="border-border/60 flex h-auto w-full justify-start gap-1 border-b bg-transparent p-0 px-2 py-1.5">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                    'data-[state=active]:bg-accent data-[state=active]:text-foreground',
                    'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-accent/50'
                  )}
                >
                  {tab.label}
                  <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px]">
                    {tab.count}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex max-h-[320px] min-h-[280px] flex-col overflow-y-auto p-2">
            {currentItems.length === 0 ? (
              <div className="text-muted-foreground/70 flex flex-1 flex-col items-center justify-center text-[13px]">
                <Upload className="mb-2 h-8 w-8 opacity-40" strokeWidth={1.5} />
                No items here
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {currentItems.map((upload) => (
                  <UploadRow key={upload.id} upload={upload} />
                ))}
              </div>
            )}
          </div>

          {active.length > 0 ? (
            <div className="border-border/60 bg-secondary/30 text-muted-foreground flex items-center justify-between border-t px-4 py-2 text-[11px]">
              <span>Encrypting and uploading...</span>
              <span className="font-medium">{active.length} active</span>
            </div>
          ) : completed.length > 0 && failed.length === 0 ? (
            <div className="border-border/60 flex items-center justify-between border-t bg-emerald-500/5 px-4 py-2 text-[11px] text-emerald-600 dark:text-emerald-400">
              <span>
                All {completed.length}/{uploads.length} items uploaded successfully!
              </span>
              <button onClick={clearCompleted} className="font-medium hover:underline">
                Clear
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
