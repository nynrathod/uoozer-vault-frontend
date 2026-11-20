import { ChevronUp, Lock } from 'lucide-react'
import { cn } from '@lib/utils'
import type { FileCategory } from './previewCategories'

interface PreviewFooterProps {
  category: FileCategory
  detailsOpen: boolean
  onToggleDetails: () => void
}

export function PreviewFooter({ category, detailsOpen, onToggleDetails }: PreviewFooterProps) {
  /** The sheet shows "BLAKE3 verified" next to the lock on document
   *  previews (chunk hashes are verified on every download). */
  const showsBlake3 =
    category === 'pdf' || category === 'markdown' || category === 'text' || category === 'code'

  return (
    <div className="uv-preview-footer">
      <Lock
        className="text-sealed h-[13px] w-[13px] shrink-0"
        strokeWidth={1.6}
        aria-hidden="true"
      />
      <span className="truncate">
        Decrypted on this device{showsBlake3 ? ' · BLAKE3 verified' : ''}
      </span>
      <button
        type="button"
        className="uv-preview-footer-toggle"
        onClick={onToggleDetails}
        aria-expanded={detailsOpen}
      >
        <span>Details</span>
        <ChevronUp
          className={cn(
            'h-[13px] w-[13px] shrink-0 transition-transform duration-[120ms]',
            detailsOpen && 'rotate-180'
          )}
          strokeWidth={1.6}
          aria-hidden="true"
        />
      </button>
    </div>
  )
}
