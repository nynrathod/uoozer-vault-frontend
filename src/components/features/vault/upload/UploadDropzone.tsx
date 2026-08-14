import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X } from 'lucide-react'
import { cn } from '@lib/utils'
import { Button } from '@ui/Button'

interface UploadDropzoneProps {
  isOpen: boolean
  onClose: () => void
  onDrop: (files: File[]) => void
}

/** Full-screen overlay dropzone for drag-and-drop file/folder uploads. */
export function UploadDropzone({ isOpen, onClose, onDrop }: UploadDropzoneProps) {
  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      onDrop(acceptedFiles)
      onClose()
    },
    [onDrop, onClose]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    noClick: false,
    useFsAccessApi: false,
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200" />
      <div className="pointer-events-auto relative w-full max-w-xl">
        <div
          {...getRootProps()}
          className={cn(
            'bg-card relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center shadow-xl transition-all duration-200',
            isDragActive
              ? 'border-primary bg-primary/[0.02]'
              : 'border-border/60 hover:border-border'
          )}
        >
          <input {...getInputProps()} />
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-accent absolute top-4 right-4 h-8 w-8 rounded-lg"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              onClose()
            }}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="bg-primary/10 text-primary mb-5 flex h-16 w-16 items-center justify-center rounded-2xl">
            <Upload className="h-8 w-8" strokeWidth={1.5} />
          </div>
          <h3 className="text-foreground text-[17px] font-semibold">
            {isDragActive ? 'Drop files or folders here' : 'Drag & drop files or folders here'}
          </h3>
          <p className="text-muted-foreground/70 mt-2 text-[13px]">
            or click to browse from your device
          </p>
        </div>
      </div>
    </div>
  )
}
