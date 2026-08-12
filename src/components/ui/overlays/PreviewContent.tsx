import { Button } from '@ui/Button'
import { FileIcon } from '@/components/features/vault/file-list/FileIcon'
import { Loader2, Download } from 'lucide-react'
import { cn } from '@lib/utils'
import { MOCK_URLS } from '@lib/constants'
import type { FileItem } from '@/types/files'

interface PreviewContentProps {
  file: FileItem
  isFullscreen: boolean
  isLoading: boolean
  setIsLoading: (val: boolean) => void
}

export function PreviewContent({
  file,
  isFullscreen,
  isLoading,
  setIsLoading,
}: PreviewContentProps) {
  const isImage = file.encryptedMimeType?.startsWith('image/')
  const isPdf = file.encryptedMimeType === 'application/pdf'
  const isText =
    file.encryptedMimeType?.startsWith('text/') || file.encryptedMimeType === 'application/document'

  const contentAreaClasses = isFullscreen
    ? 'flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden relative bg-[#0a0a0a]'
    : 'flex-1 flex items-center justify-center p-4 md:p-6 overflow-hidden relative bg-muted/40'

  return (
    <div className={contentAreaClasses}>
      {isLoading && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            isFullscreen ? 'bg-[#0a0a0a]' : 'bg-muted/30'
          )}
        >
          <Loader2
            className={cn(
              'h-8 w-8 animate-spin',
              isFullscreen ? 'text-white/50' : 'text-muted-foreground'
            )}
          />
        </div>
      )}

      <div
        className={cn(
          'bg-card border-border/50 flex h-full max-h-full w-full max-w-full flex-col items-center justify-center overflow-hidden rounded-xl border shadow-lg',
          isFullscreen && 'max-h-[85vh] max-w-5xl'
        )}
      >
        {isImage && (
          <img
            src={MOCK_URLS.UNSPLASH_IMAGE}
            alt={file.encryptedName}
            className={cn(
              'max-h-full max-w-full object-contain transition-opacity duration-300',
              isLoading ? 'opacity-0' : 'opacity-100'
            )}
            onLoad={() => setIsLoading(false)}
          />
        )}
        {isPdf && (
          <object
            data={`${MOCK_URLS.DUMMY_PDF}#toolbar=1&navpanes=0`}
            type="application/pdf"
            className={cn(
              'h-full w-full transition-opacity duration-300',
              isLoading ? 'opacity-0' : 'opacity-100'
            )}
          >
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <p className="text-muted-foreground mb-4">
                Your browser does not support inline PDFs.
              </p>
              <a
                href={MOCK_URLS.DUMMY_PDF}
                download
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                Download PDF
              </a>
            </div>
          </object>
        )}
        {isText && (
          <div
            className={cn(
              'h-full w-full overflow-y-auto p-6 text-left transition-opacity duration-300 md:p-8',
              isLoading ? 'opacity-0' : 'opacity-100'
            )}
          >
            <h1 className="mb-6 text-xl font-bold text-neutral-900 md:text-2xl">
              {file.encryptedName}
            </h1>
            <div className="prose prose-sm max-w-none space-y-4 leading-relaxed text-neutral-600">
              <p>
                This is a simulated text preview for <strong>{file.encryptedName}</strong>. In a
                production zero-knowledge environment, the actual file content would be fetched in
                encrypted chunks from the server, decrypted client-side using your Master Key, and
                rendered securely here in the DOM.
              </p>
            </div>
          </div>
        )}
        {!isImage && !isPdf && !isText && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div
              className={cn(
                'mb-5 flex h-20 w-20 items-center justify-center rounded-2xl',
                isFullscreen ? 'bg-white/10' : 'bg-secondary'
              )}
            >
              <FileIcon
                mimeType={file.encryptedMimeType}
                size="lg"
                className={cn(
                  'bg-transparent',
                  isFullscreen ? 'text-white/50' : 'text-muted-foreground'
                )}
              />
            </div>
            <h3
              className={cn(
                'mb-1 text-lg font-semibold',
                isFullscreen ? 'text-white' : 'text-foreground'
              )}
            >
              No preview available
            </h3>
            <p
              className={cn(
                'mb-6 max-w-sm text-sm',
                isFullscreen ? 'text-white/50' : 'text-muted-foreground'
              )}
            >
              We can't show a preview for this file type in your browser. Please download it to view
              its contents.
            </p>
            <Button variant="secondary" className="gap-1.5">
              <Download className="h-4 w-4" /> Download file
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
