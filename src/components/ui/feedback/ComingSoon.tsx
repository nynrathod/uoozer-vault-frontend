import type { LucideIcon } from 'lucide-react'
import { cn } from '@lib/utils'

interface ComingSoonProps {
  icon: LucideIcon
  title: string
  description?: string
  className?: string
}

/** Minimal, premium placeholder for unbuilt features. */
export function ComingSoon({ icon: Icon, title, description, className }: ComingSoonProps) {
  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center p-8 text-center',
        className
      )}
    >
      <div className="relative mb-8 flex h-20 w-20 items-center justify-center">
        {/* Outer pulsing ring */}
        <div
          className="bg-primary/10 absolute inset-0 rounded-2xl"
          style={{ animation: 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
        ></div>
        {/* Inner border ring */}
        <div
          className="border-primary/20 absolute inset-0 rounded-2xl border-2"
          style={{ animation: 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
        ></div>

        {/* Icon */}
        <Icon className="text-primary relative z-10 h-8 w-8" strokeWidth={1.5} />
      </div>

      <h2 className="text-foreground text-xl font-semibold tracking-tight">{title}</h2>
      {description && (
        <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">{description}</p>
      )}

      <div className="bg-secondary/50 border-border text-muted-foreground mt-6 rounded-full border px-4 py-1.5 text-[11px] font-medium tracking-wide uppercase">
        Coming Soon
      </div>
    </div>
  )
}
