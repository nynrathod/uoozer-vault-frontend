import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@lib/utils'

const DropdownContext = React.createContext<{ close: () => void } | null>(null)

/** Props for the DropdownMenu component. */
interface DropdownMenuProps {
  trigger: React.ReactNode
  children: React.ReactNode
  align?: 'start' | 'end'
  className?: string
  containerClassName?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/** Portal-based dropdown menu with collision-aware positioning. */
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

      const menuHeight = menuRect.height
      const menuWidth = menuRect.width
      const spaceBelow = window.innerHeight - triggerRect.bottom
      const spaceAbove = triggerRect.top

      let topPos = triggerRect.bottom + 4

      if (spaceBelow < menuHeight && spaceAbove > menuHeight) {
        topPos = triggerRect.top - menuHeight - 4
      }

      let leftPos = align === 'end' ? triggerRect.right - menuWidth : triggerRect.left

      if (leftPos + menuWidth > window.innerWidth - 8) {
        leftPos = window.innerWidth - menuWidth - 8
      }
      if (leftPos < 8) {
        leftPos = 8
      }

      setCoords({ top: topPos, left: leftPos, ready: true })
    } else if (!isOpen) {
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
                style={{
                  top: `${coords.top}px`,
                  left: `${coords.left}px`,
                  // Hidden until exact coordinates are calculated to prevent a flash at (0,0)
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

/** Props for a DropdownItem button. */
interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  destructive?: boolean
  preventClose?: boolean
}

/** Actionable item inside a DropdownMenu. */
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

/** Horizontal divider line for dropdown menus. */
function DropdownSeparator({ className }: { className?: string }) {
  return <div className={cn('bg-border/60 -mx-1.5 my-1 h-px', className)} />
}

/** Non-interactive label text for grouping items in a dropdown. */
function DropdownLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('text-muted-foreground/70 px-2.5 py-1.5 text-[11px] font-semibold', className)}
      {...props}
    />
  )
}

export { DropdownMenu, DropdownItem, DropdownSeparator, DropdownLabel }
