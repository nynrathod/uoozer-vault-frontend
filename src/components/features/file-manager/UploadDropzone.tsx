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
    noClick: true,
  })

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="pointer-events-auto w-full max-w-xl">
          <div
            {...getRootProps()}
            className={cn(
              'bg-card relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center shadow-xl transition-all duration-200',
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
              onClick={(e) => {
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
              {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
            </h3>
            <p className="text-muted-foreground/70 mt-2 text-[13px]">
              or click to browse from your device
            </p>
            <p className="text-muted-foreground/50 mt-1 text-[11px]">Supports files up to 10GB</p>
          </div>
        </div>
      </div>
    </>
  )
}
