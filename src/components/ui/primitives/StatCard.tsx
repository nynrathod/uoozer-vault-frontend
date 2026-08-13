import { cn } from '@lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  className?: string
  valueClassName?: string
}

export function StatCard({ label, value, className, valueClassName }: StatCardProps) {
  return (
    <div className={cn('border-border/60 rounded-xl border p-4', className)}>
      <p className="text-muted-foreground/50 text-[11px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className={cn('mt-1 text-2xl font-semibold', valueClassName)}>{value}</p>
    </div>
  )
}
