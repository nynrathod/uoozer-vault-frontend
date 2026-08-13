import { Check } from 'lucide-react'
import { cn } from '@lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface SelectableCardProps {
  selected: boolean
  onClick: () => void
  icon?: LucideIcon
  leading?: ReactNode
  label: string
  className?: string
}

export function SelectableCard({
  selected,
  onClick,
  icon: Icon,
  leading,
  label,
  className,
}: SelectableCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'border-border flex items-center gap-3 rounded-lg border p-3 transition-all',
        selected ? 'border-primary bg-primary/[0.04]' : 'hover:bg-accent/50',
        className
      )}
    >
      {leading ? leading : Icon ? <Icon className="text-muted-foreground/70 h-5 w-5" /> : null}
      <span className="text-[13px] font-medium">{label}</span>
      {selected && <Check className="text-primary ml-auto h-4 w-4" />}
    </button>
  )
}
