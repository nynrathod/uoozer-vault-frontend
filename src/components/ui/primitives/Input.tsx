import * as React from 'react'
import { cn } from '@lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/** Styled text input with consistent focus and disabled states. */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'border-border/60 bg-background text-foreground flex h-10 w-full rounded-lg border px-3 py-2 text-[13px] transition-colors duration-150',
          'placeholder:text-muted-foreground/50',
          'hover:border-border',
          'focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.08)] focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
