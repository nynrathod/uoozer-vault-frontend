import { Button } from '@ui/Button'
import { Download, type LucideIcon } from 'lucide-react'

interface PreviewEmptyProps {
  icon: LucideIcon
  title: string
  description?: string
  onDownload: () => void
  onOpenWith?: () => void
}

export function PreviewEmpty({
  icon: Icon,
  title,
  description = 'Files are decrypted only on this device. Download to open it, or open it in another app.',
  onDownload,
  onOpenWith,
}: PreviewEmptyProps) {
  return (
    <div className="uv-preview-empty shrink-0">
      <div className="uv-preview-empty-icon">
        <Icon className="h-[26px] w-[26px]" strokeWidth={1.6} aria-hidden="true" />
      </div>
      <div className="uv-preview-empty-title">{title}</div>
      <div className="uv-preview-empty-desc">{description}</div>
      <div className="uv-preview-empty-actions">
        <Button variant="default" className="h-9 px-4" onClick={onDownload}>
          <Download className="h-[15px] w-[15px]" strokeWidth={1.6} aria-hidden="true" />
          Download
        </Button>
        {/* {onOpenWith && (
          <button
            type="button"
            className="uv-preview-action uv-preview-action-lg"
            onClick={onOpenWith}
          >
            Open with
            <ChevronDown className="h-[13px] w-[13px]" strokeWidth={1.6} aria-hidden="true" />
          </button>
        )} */}
      </div>
    </div>
  )
}
