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
} from 'lucide-react'
import { cn } from '@lib/utils'
import { FILE_TYPE_COLORS } from '@lib/constants'

interface FileIconProps {
  mimeType?: string
  isFolder?: boolean
  size?: 'sm' | 'default' | 'lg'
  className?: string
}

export function FileIcon({ mimeType, isFolder, size = 'default', className }: FileIconProps) {
  const sizeClasses = {
    sm: 'h-9 w-9 p-[7px]',
    default: 'h-10 w-10 p-2',
    lg: 'h-16 w-16 p-3',
  }

  if (isFolder) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl bg-blue-500/[0.08] text-blue-500',
          sizeClasses[size],
          className
        )}
      >
        <Folder className="h-full w-full" strokeWidth={1.8} />
      </div>
    )
  }

  const type = mimeType?.startsWith('image/')
    ? 'image'
    : mimeType?.startsWith('video/')
      ? 'video'
      : mimeType?.startsWith('audio/')
        ? 'audio'
        : mimeType === 'application/pdf'
          ? 'pdf'
          : mimeType?.includes('zip')
            ? 'archive'
            : mimeType?.includes('spreadsheet') || mimeType?.includes('excel')
              ? 'spreadsheet'
              : mimeType?.includes('presentation') || mimeType?.includes('powerpoint')
                ? 'presentation'
                : mimeType?.includes('document') || mimeType?.includes('word')
                  ? 'document'
                  : 'file'

  const IconMap: Record<string, React.ElementType> = {
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

  const Icon = IconMap[type] || File
  const colorClass = FILE_TYPE_COLORS[type] || FILE_TYPE_COLORS.file

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl',
        colorClass,
        sizeClasses[size],
        className
      )}
    >
      <Icon className="h-full w-full" strokeWidth={1.8} />
    </div>
  )
}
