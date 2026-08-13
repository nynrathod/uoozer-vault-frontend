import type { LucideIcon } from 'lucide-react'
import { cn } from '@lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  className?: string
  children?: React.ReactNode
}

export function PageHeader({ title, subtitle, icon: Icon, className, children }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'border-border/60 flex h-[60px] shrink-0 items-center justify-between border-b px-6',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {Icon && <Icon className="text-primary h-5 w-5" strokeWidth={1.8} />}
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {subtitle && <p className="text-muted-foreground/60 text-[11px]">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}
