import * as React from 'react'
import { cn } from '@lib/utils'

const DropdownContext = React.createContext<{ close: () => void } | null>(null)

interface DropdownMenuProps {
  trigger: React.ReactNode
  children: React.ReactNode
  align?: 'start' | 'end'
  className?: string
  containerClassName?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function DropdownMenu({
  trigger,
  children,
  align = 'end',
  className,
  containerClassName,
  open: controlledOpen,
  onOpenChange,
}: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const toggle = (value: boolean) => {
    if (isControlled) onOpenChange?.(value)
    else setInternalOpen(value)
  }

  const close = React.useCallback(() => toggle(false), [isControlled, onOpenChange])

  return (
    <DropdownContext.Provider value={{ close }}>
      <div className={cn('relative inline-block', containerClassName)}>
        {/* Trigger Wrapper */}
        <div
          onClick={(e) => {
            e.stopPropagation()
            if (isControlled) onOpenChange?.(!isOpen)
            else setInternalOpen(!isOpen)
          }}
        >
          {trigger}
        </div>

        {isOpen && (
          <>
            {/* Invisible Overlay to catch outside clicks */}
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation() // Prevents row click from firing when clicking outside
                close()
              }}
            />

            {/* Dropdown Menu Content */}
            <div
              className={cn(
                'border-border bg-popover text-popover-foreground absolute z-50 min-w-[12rem] rounded-xl border p-1.5 shadow-lg',
                align === 'end' ? 'right-0' : 'left-0',
                'top-full mt-1.5',
                className
              )}
              onClick={(e) => e.stopPropagation()} // Prevents row click from firing when clicking inside
            >
              {children}
            </div>
          </>
        )}
      </div>
    </DropdownContext.Provider>
  )
}

interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  destructive?: boolean
  preventClose?: boolean
}

function DropdownItem({
  className,
  icon,
  destructive,
  preventClose,
  children,
  onClick,
  ...props
}: DropdownItemProps) {
  const ctx = React.useContext(DropdownContext)
  return (
    <button
      className={cn(
        'relative flex w-full cursor-pointer items-center rounded-lg px-2.5 py-[7px] text-[13px] transition-colors outline-none select-none',
        'hover:bg-accent hover:text-accent-foreground',
        destructive && 'text-red-600 hover:bg-red-500/10 hover:text-red-600',
        className
      )}
      onClick={(e) => {
        e.stopPropagation() // Prevents row click from firing
        onClick?.(e) // Performs the action (e.g., opens delete dialog)
        if (!preventClose) ctx?.close() // Closes the menu
      }}
      {...props}
    >
      {icon && <span className="mr-2.5 h-4 w-4 opacity-70">{icon}</span>}
      {children}
    </button>
  )
}

function DropdownSeparator({ className }: { className?: string }) {
  return <div className={cn('bg-border/60 -mx-1.5 my-1 h-px', className)} />
}

function DropdownLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('text-muted-foreground/70 px-2.5 py-1.5 text-[11px] font-semibold', className)}
      {...props}
    />
  )
}

export { DropdownMenu, DropdownItem, DropdownSeparator, DropdownLabel }
