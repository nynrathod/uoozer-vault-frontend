import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'

import { cn } from '@lib/utils'

/** Style variants for the Button component. */
const buttonVariants = cva(
  'focus-visible:outline-ring inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-xs hover:bg-[hsl(var(--brand-hover))] hover:shadow-sm active:bg-[hsl(var(--brand-active))]',

        primary:
          'bg-primary text-primary-foreground shadow-xs hover:bg-[hsl(var(--brand-hover))] hover:shadow-sm active:bg-[hsl(var(--brand-active))]',

        cta: 'bg-cta text-cta-foreground font-semibold shadow-xs hover:bg-[hsl(var(--cta-hover))] hover:shadow-sm active:bg-[hsl(var(--cta-active))]',

        secondary:
          'bg-secondary text-secondary-foreground border-border hover:bg-accent hover:border-border-hover border',

        ghost: 'text-foreground hover:bg-accent bg-transparent',

        outline:
          'text-foreground border-border hover:bg-accent hover:border-border-hover border bg-transparent',

        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',

        link: 'text-primary bg-transparent underline-offset-4 hover:underline',
      },

      size: {
        default: 'h-9 px-3.5',
        sm: 'h-[30px] px-2.5 text-xs',
        lg: 'h-11 px-5 text-[15px]',
        icon: 'h-9 w-9 p-0',
        'icon-sm': 'h-[30px] w-[30px] p-0',
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
