import { HardDrive, Calendar, User, History } from 'lucide-react'
import { formatBytes, formatRelativeDate } from '@lib/utils'
import { useFileStore, selectFileById } from '@stores/fileStore'
import { usePreviewStore } from '@stores/previewStore'

/** Metadata panel showing file size, modified date, owner, and version. */
export function PreviewFooter() {
  const fileId = usePreviewStore((s) => s.fileId)
  const file = useFileStore(selectFileById(fileId))

  if (!file) return null

  return (
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
  )
}
