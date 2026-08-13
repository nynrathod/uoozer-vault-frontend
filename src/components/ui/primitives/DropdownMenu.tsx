import * as React from 'react'
import { createPortal } from 'react-dom'
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
  align = 'start',
  className,
  containerClassName,
  open: controlledOpen,
  onOpenChange,
}: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  // Store position and a 'ready' flag to prevent 1-frame flashing
  const [coords, setCoords] = React.useState<{ top: number; left: number; ready: boolean }>({
    top: 0,
    left: 0,
    ready: false,
  })

  const triggerRef = React.useRef<HTMLDivElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const toggle = (value: boolean) => {
    if (isControlled) onOpenChange?.(value)
    else setInternalOpen(value)
  }

  const close = React.useCallback(() => toggle(false), [isControlled, onOpenChange])

  React.useLayoutEffect(() => {
    if (isOpen && triggerRef.current && menuRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const menuRect = menuRef.current.getBoundingClientRect()

      // Measure exact heights dynamically
      const menuHeight = menuRect.height
      const menuWidth = menuRect.width
      const spaceBelow = window.innerHeight - triggerRect.bottom
      const spaceAbove = triggerRect.top

      let topPos = triggerRect.bottom + 4 // Default to below

      // Industry standard collision check: If no space below, flip to top
      if (spaceBelow < menuHeight && spaceAbove > menuHeight) {
        topPos = triggerRect.top - menuHeight - 4
      }

      // Align left or right based on prop, keep it attached to trigger (no weird right shifting)
      let leftPos = align === 'end' ? triggerRect.right - menuWidth : triggerRect.left

      // Basic boundary check just to keep it on screen if it hits the right edge
      if (leftPos + menuWidth > window.innerWidth - 8) {
        leftPos = window.innerWidth - menuWidth - 8
      }
      if (leftPos < 8) {
        leftPos = 8
      }

      // Set final coords and mark as ready to show
      setCoords({ top: topPos, left: leftPos, ready: true })
    } else if (!isOpen) {
      // Reset ready state when closed so it recalculates next time
      setCoords((prev) => ({ ...prev, ready: false }))
    }
  }, [isOpen, align])

  return (
    <DropdownContext.Provider value={{ close }}>
      <div
        className={cn('relative inline-block', containerClassName)}
        ref={triggerRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          onClick={(e) => {
            e.stopPropagation()
            toggle(!isOpen)
          }}
        >
          {trigger}
        </div>

        {isOpen &&
          createPortal(
            <>
              <div
                className="fixed inset-0 z-[9998]"
                onClick={(e) => {
                  e.stopPropagation()
                  close()
                }}
              />
              <div
                ref={menuRef}
                className={cn(
                  'bg-popover border-border text-popover-foreground animate-scale-in fixed z-[9999] min-w-[12rem] rounded-xl border p-1.5 shadow-lg',
                  className
                )}
                // Hide visibility until exact coordinates are calculated to prevent flashing at top-left corner
                style={{
                  top: `${coords.top}px`,
                  left: `${coords.left}px`,
                  visibility: coords.ready ? 'visible' : 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {children}
              </div>
            </>,
            document.body
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
        e.stopPropagation()
        onClick?.(e)
        if (!preventClose) ctx?.close()
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
