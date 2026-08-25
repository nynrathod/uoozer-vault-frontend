import { memo } from 'react'
import {
  FileText,
  Image,
  Video,
  Music,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  Presentation,
  File,
  Folder,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@lib/utils'
import { FILE_TYPE_COLORS } from '@lib/constants'

interface FileIconProps {
  mimeType?: string
  isFolder?: boolean
  size?: 'sm' | 'default' | 'lg'
  className?: string
}

/** Displays a typed icon for a file or folder, color-coded by MIME category. */
export const FileIcon = memo(function FileIcon({
  mimeType,
  isFolder,
  size = 'default',
  className,
}: FileIconProps) {
  const sizeClasses = {
    sm: 'h-8 w-8 p-1.5 rounded-md',
    default: 'h-10 w-10 p-2 rounded-lg',
    lg: 'h-16 w-16 p-3 rounded-xl',
  }

  if (isFolder) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center bg-gradient-to-br from-blue-500/15 to-blue-500/5 text-blue-500',
          sizeClasses[size],
          className
        )}
      >
        <Folder className="h-full w-full drop-shadow-sm" strokeWidth={1.1} />
      </div>
    )
  }

  // Cascading MIME classification: checks prefix patterns first, then specific type matches,
  // then extension-based code detection, falling back to generic file icon
  const ext = mimeType?.split('/').pop() || ''
  const type = mimeType?.startsWith('image/')
    ? 'image'
    : mimeType?.startsWith('video/')
      ? 'video'
      : mimeType?.startsWith('audio/')
        ? 'audio'
        : mimeType === 'application/pdf'
          ? 'pdf'
          : mimeType?.includes('zip') || mimeType?.includes('compressed')
            ? 'archive'
            : [
                  'javascript',
                  'typescript',
                  'json',
                  'xml',
                  'python',
                  'java',
                  'csharp',
                  'cpp',
                  'html',
                  'css',
                ].includes(ext)
              ? 'code'
              : mimeType?.includes('spreadsheet') || mimeType?.includes('excel')
                ? 'spreadsheet'
                : mimeType?.includes('presentation') || mimeType?.includes('powerpoint')
                  ? 'presentation'
                  : mimeType?.includes('document') ||
                      mimeType?.includes('word') ||
                      mimeType?.includes('text')
                    ? 'document'
                    : 'file'

  const IconMap: Record<string, LucideIcon> = {
    image: Image,
    video: Video,
    audio: Music,
    pdf: FileText,
    archive: FileArchive,
    code: FileCode,
    spreadsheet: FileSpreadsheet,
    presentation: Presentation,
    document: FileText,
    file: File,
  }

  const Icon: LucideIcon = IconMap[type] || File
  const colorClass = FILE_TYPE_COLORS[type] || FILE_TYPE_COLORS.file

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center',
        colorClass,
        sizeClasses[size],
        className
      )}
    >
      <Icon className="h-full w-full" strokeWidth={1.1} />
    </div>
  )
})
