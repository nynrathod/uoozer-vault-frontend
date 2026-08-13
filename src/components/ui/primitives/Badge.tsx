import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@lib/utils'

/** Style variants for the Badge component. */
const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary',
        secondary: 'bg-secondary text-muted-foreground',
        destructive: 'bg-destructive/10 text-destructive',
        success: 'bg-emerald-500/10 text-emerald-600',
        outline: 'border-border text-foreground border',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

/** Small label for status indicators, tags, and counts. */
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
