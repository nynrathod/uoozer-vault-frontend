import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@lib/utils'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

/** Portal-based modal dialog with backdrop and animated content. */
function Dialog({ open, onOpenChange, children, className }: DialogProps) {
  if (!open) return null

  return createPortal(
    <>
      <div
        className="animate-fade-in fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div
          className={cn(
            'border-border/60 bg-card pointer-events-auto w-full max-w-lg rounded-2xl border p-6 shadow-xl',
            'animate-scale-in',
            className
          )}
        >
          {children}
        </div>
      </div>
    </>,
    document.body
  )
}

/** Container for the dialog title and description. */
function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col gap-1.5 text-left sm:text-left', className)} {...props} />
  )
}

/** Accessible heading element inside a dialog. */
function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('text-[17px] leading-none font-semibold tracking-tight', className)}
      {...props}
    />
  )
}

/** Secondary text providing context for the dialog. */
function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-muted-foreground/80 text-[13px] leading-relaxed', className)}
      {...props}
    />
  )
}

/** Container for dialog action buttons, right-aligned on larger screens. */
function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

/** Close button positioned in the top-right corner of the dialog. */
function DialogClose({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-muted-foreground/60 hover:bg-accent hover:text-foreground absolute top-4 right-4 rounded-lg p-1 transition-colors"
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </button>
  )
}

export { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose }
