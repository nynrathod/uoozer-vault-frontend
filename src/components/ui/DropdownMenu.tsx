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
  const ref = React.useRef<HTMLDivElement>(null)

  const toggle = (value: boolean) => {
    if (isControlled) onOpenChange?.(value)
    else setInternalOpen(value)
  }

  const close = React.useCallback(() => toggle(false), [isControlled, onOpenChange])

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) close()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [close])

  return (
    <DropdownContext.Provider value={{ close }}>
      <div ref={ref} className={cn('relative inline-block', containerClassName)}>
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
          <div
            className={cn(
              'border-border absolute z-50 min-w-[12rem] rounded-xl border p-1.5 shadow-lg',
              'bg-popover text-popover-foreground',
              align === 'end' ? 'right-0' : 'left-0',
              'top-full mt-1.5',
              className
            )}
          >
            {children}
          </div>
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
