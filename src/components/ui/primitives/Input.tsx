import * as React from 'react'
import { cn } from '@lib/utils'

/**
 * Fields (Components sheet — rendered markup is the ground truth):
 *   Default  44 high · radius 10 · Active fill #F3F5F9 · NO border ·
 *            padding 0 14 · 14/20 · ink label · placeholder #5B6473
 *   Focus    white fill + 2px Blue ring (#2563EB) — always visible
 *   Error    #FEF2F2 fill + 1.5px #DC2626 ring; helper text is set by
 *            the form layer
 *
 * Pass aria-invalid for the error state. Every value flows from the
 * design tokens in index.css — nothing is local.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/** Styled text input with consistent focus and disabled states. */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'bg-active-surface text-ink placeholder:text-placeholder flex h-11 w-full rounded-lg border-0 px-3.5 text-[14px] leading-5 font-normal transition-all duration-[120ms]',
          'hover:bg-active-surface',
          'focus-visible:bg-popover focus-visible:shadow-[0_0_0_2px_hsl(var(--ring))] focus-visible:outline-none',
          'aria-invalid:bg-danger-tint aria-invalid:shadow-[0_0_0_1.5px_hsl(var(--danger))]',
          'disabled:cursor-not-allowed disabled:opacity-70',
          'file:border-0 file:bg-transparent file:text-[13.5px] file:font-medium',
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
