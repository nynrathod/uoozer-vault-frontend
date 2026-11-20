import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'

import { cn } from '@lib/utils'

/**
 * Buttons (Components sheet — rendered markup is the ground truth):
 *   Primary  "Unlock vault" — Blue #2563EB fill, white label, hover #1D4ED8
 *   Soft     "Upload"       — Tint #EEF3FE fill, blue-ink #1D4ED8 label
 *   Ghost    "Cancel"       — plain #374151 text, Hover surface on hover
 *   Danger   "Delete"       — red #B91C1C text, danger tint on hover
 *   Busy     "Deriving key…"— Blue at opacity .7 with a spinner
 *
 * 36 high · radius 8 · padding 0 14 · 13.5/20 · 500 · gap 6 · FLAT (the
 * sheet shows no shadow on buttons) · 120ms motion · 2px blue focus ring
 * with 2px offset, always on. Every value flows from index.css tokens.
 */
const buttonVariants = cva(
  'focus-visible:outline-ring inline-flex items-center justify-center gap-1.5 rounded-md text-[13.5px] leading-5 font-medium outline outline-2 outline-offset-2 outline-transparent transition-all duration-[120ms] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70',
  {
    variants: {
      variant: {
        /** Primary — "Unlock vault" */
        default:
          'bg-primary text-primary-foreground hover:bg-brand-hover active:bg-brand-active',
        primary:
          'bg-primary text-primary-foreground hover:bg-brand-hover active:bg-brand-active',

        /** CTA — same accent, kept for compatibility with existing screens */
        cta: 'bg-cta text-cta-foreground hover:bg-brand-hover active:bg-brand-active',

        /** Soft — "Upload" (Tint fill, blue-ink label) */
        soft: 'bg-tint text-blue-ink hover:bg-selection active:bg-tint',

        /** Quiet field-like button */
        secondary: 'bg-active-surface text-ink hover:bg-hover-surface active:bg-active-surface',

        /** Ghost — "Cancel" (plain #374151 text) */
        ghost: 'text-gray-ui bg-transparent hover:bg-hover-surface',

        outline: 'text-gray-ui border border-line bg-transparent hover:bg-hover-surface',

        /** Danger — solid */
        destructive: 'bg-danger text-white hover:bg-danger/90',

        /** Danger — text only, tint on hover ("Delete") */
        destructiveText: 'text-failed bg-transparent hover:bg-danger-tint',

        link: 'text-blue-ink bg-transparent underline-offset-4 hover:underline',
      },

      size: {
        default: 'h-9 px-3.5',
        sm: 'h-[30px] px-2.5 text-[12.5px]',
        lg: 'h-11 px-4 text-[14px]',
        icon: 'h-7 w-7 rounded-sm p-0',
        'icon-sm': 'h-6 w-6 rounded-sm p-0',
      },
    },

    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

/** Primary button component with variant and size support. */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}

        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button, buttonVariants }
