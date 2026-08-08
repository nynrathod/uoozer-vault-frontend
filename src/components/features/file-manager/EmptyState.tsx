import { FolderOpen, Upload } from 'lucide-react'
import { Button } from '@ui/Button'

interface EmptyStateProps {
  onUpload?: () => void
  title?: string
  description?: string
}

export function EmptyState({
  onUpload,
  title = 'No files yet',
  description = 'Upload your first file to get started',
}: EmptyStateProps) {
  return (
    <div className="animate-fade-in flex flex-col items-center justify-center py-20 text-center">
      <div className="bg-secondary/80 text-muted-foreground/60 mb-5 flex h-16 w-16 items-center justify-center rounded-2xl">
        <FolderOpen className="h-8 w-8" strokeWidth={1.5} />
      </div>
      <h3 className="text-foreground text-[15px] font-semibold">{title}</h3>
      <p className="text-muted-foreground/70 mt-1.5 max-w-xs text-[13px] leading-relaxed">
        {description}
      </p>
      {onUpload && (
        <Button onClick={onUpload} className="mt-6 gap-2 rounded-lg px-4">
          <Upload className="h-4 w-4" />
          Upload files
        </Button>
      )}
    </div>
  )
}
