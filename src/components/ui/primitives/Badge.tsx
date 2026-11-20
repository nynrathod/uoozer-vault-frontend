import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@lib/utils'

/**
 * Status labels (Foundations · Status + Components sheet, rendered markup):
 *   Sealed   #047857 on #E7F7EF  — encrypted, uploaded
 *   Working  #1D4ED8 on #EEF3FE  — encrypting, uploading
 *   Heads-up #B45309 on #FEF3C7  — burns, expires, offline
 *   Failed   #B91C1C on #FEE2E2  — error, needs retry
 *   Tag      #1D4ED8 on #EEF3FE  — plain tags ("#ideas")
 *
 * Chips/pills — EXACT: 26 high · radius 999 · padding 0 10 · gap 6 ·
 * 12.5/500. Always a dark ink on a pale tint, never colour alone.
 */
const badgeVariants = cva(
  'inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium transition-colors',
  {
    variants: {
      variant: {
        /** Tinted blue chip (default accent) */
        default: 'bg-tint text-blue-ink',
        /** Neutral tag — Hover surface + meta ink */
        secondary: 'bg-hover-surface text-muted-foreground',
        /** Failed / error */
        destructive: 'bg-failed-tint text-failed',
        /** Sealed — encrypted, uploaded */
        success: 'bg-sealed-tint text-sealed',
        /** Working — encrypting, uploading */
        working: 'bg-working-tint text-working',
        /** Heads-up — burns, expires, offline */
        headsUp: 'bg-headsup-tint text-headsup',
        outline: 'border border-line text-gray-ui',
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

export { badgeVariants }
