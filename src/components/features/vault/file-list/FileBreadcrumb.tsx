import { memo } from 'react'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@lib/utils'
import type { Folder } from '@/types/folders'

interface FileBreadcrumbProps {
  path: Folder[]
  onNavigate: (folderId: string | null) => void
}

export const FileBreadcrumb = memo(function FileBreadcrumb({
  path,
  onNavigate,
}: FileBreadcrumbProps) {
  return (
    <nav className="no-scrollbar flex items-center gap-0.5 overflow-x-auto px-4 py-2.5 text-[13px]">
      <button
        onClick={() => onNavigate(null)}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors duration-150',
          path.length === 0
            ? 'text-foreground'
            : 'text-muted-foreground/70 hover:bg-accent/60 hover:text-foreground'
        )}
      >
        <Home className="h-3.5 w-3.5" strokeWidth={2} />
        <span>Vault</span>
      </button>
      {path.map((folder, index) => (
        <div key={folder.id} className="flex items-center gap-0.5">
          <ChevronRight className="text-muted-foreground/30 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <button
            onClick={() => onNavigate(folder.id)}
            className={cn(
              'max-w-[160px] truncate rounded-md px-2 py-1 transition-colors duration-150',
              index === path.length - 1
                ? 'text-foreground font-medium'
                : 'text-muted-foreground/70 hover:bg-accent/60 hover:text-foreground'
            )}
          >
            {folder.encryptedName}
          </button>
        </div>
      ))}
    </nav>
  )
})
