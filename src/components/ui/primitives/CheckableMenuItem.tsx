import { Check } from 'lucide-react'
import { cn } from '@lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface CheckableMenuItemProps {
  label: string
  icon?: LucideIcon
  leading?: ReactNode
  isActive: boolean
  onClick: () => void
  className?: string
}

/** Menu item with a check indicator for toggle-style selections. */
export function CheckableMenuItem({
  label,
  icon: Icon,
  leading,
  isActive,
  onClick,
  className,
}: CheckableMenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-foreground hover:bg-accent flex w-full items-center justify-between rounded-lg px-2.5 py-[6px] text-[13px] transition-colors',
        className
      )}
    >
      <span className="flex items-center gap-2.5">
        {leading ? leading : Icon ? <Icon className="text-muted-foreground/60 h-4 w-4" /> : null}
        {label}
      </span>
      {isActive && <Check className="text-primary h-3.5 w-3.5" strokeWidth={3} />}
    </button>
  )
}
