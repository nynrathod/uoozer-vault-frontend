import { Button } from '@ui/Button'
import { History, Download, RotateCcw, MoreVertical } from 'lucide-react'
import { cn, formatRelativeDate } from '@lib/utils'
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui'

interface Version {
  id: string
  versionNumber: number
  modifiedAt: string
  modifiedBy: string
  size: string
  isCurrent: boolean
}

interface VersionHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileName: string
}

const mockVersions: Version[] = [
  {
    id: 'v3',
    versionNumber: 3,
    modifiedAt: new Date().toISOString(),
    modifiedBy: 'You',
    size: '2.4 MB',
    isCurrent: true,
  },
  {
    id: 'v2',
    versionNumber: 2,
    modifiedAt: new Date(Date.now() - 86400000).toISOString(),
    modifiedBy: 'You',
    size: '2.1 MB',
    isCurrent: false,
  },
  {
    id: 'v1',
    versionNumber: 1,
    modifiedAt: new Date(Date.now() - 172800000).toISOString(),
    modifiedBy: 'You',
    size: '1.8 MB',
    isCurrent: false,
  },
]

export function VersionHistoryDialog({ open, onOpenChange, fileName }: VersionHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <History className="text-muted-foreground h-4 w-4" />
          Version history
        </DialogTitle>
        <DialogDescription className="truncate">{fileName}</DialogDescription>
      </DialogHeader>

      <div className="-mx-2 mt-4 max-h-[400px] space-y-1 overflow-y-auto px-2">
        {mockVersions.map((v) => (
          <div
            key={v.id}
            className={cn(
              'flex items-center justify-between rounded-lg border p-3 transition-colors',
              v.isCurrent
                ? 'border-primary/20 bg-primary/[0.03]'
                : 'border-border/60 hover:bg-accent/50'
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold',
                  v.isCurrent ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
                )}
              >
                v{v.versionNumber}
              </div>
              <div>
                <p className="flex items-center gap-2 text-[13px] font-medium">
                  {v.isCurrent && (
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-emerald-600 uppercase">
                      Current
                    </span>
                  )}
                  {formatRelativeDate(v.modifiedAt)}
                </p>
                <p className="text-muted-foreground/70 text-[11px]">
                  {v.modifiedBy} • {v.size}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {!v.isCurrent && (
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg text-[12px]">
                  <RotateCcw className="h-3.5 w-3.5" /> Restore
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground h-8 w-8 rounded-lg"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground h-8 w-8 rounded-lg"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  )
}
