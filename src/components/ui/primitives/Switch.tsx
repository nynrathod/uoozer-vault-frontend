import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'
import { cn } from '@lib/utils'

/**
 * Switch (Components sheet — "Controls and status", rendered markup):
 *   track  36×20 · radius 999 · ON = Blue #2563EB · OFF = ghost #8A93A3
 *   knob   16×16 white circle, inset 2 · 120ms motion · 2px blue focus ring
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'peer focus-visible:outline-ring data-[state=checked]:bg-primary data-[state=unchecked]:bg-ghost inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full p-0.5 outline outline-2 outline-offset-2 outline-transparent transition-colors duration-[120ms] focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-70',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'bg-popover pointer-events-none block h-4 w-4 rounded-full transition-transform duration-[120ms] data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0'
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
