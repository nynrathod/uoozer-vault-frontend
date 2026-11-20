import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { cn } from '@lib/utils'

/**
 * Checkbox (Components sheet — "Controls and status", rendered markup):
 *   checked    18×18 · radius 5 · Blue #2563EB fill · white check (3.4 stroke)
 *   unchecked  18×18 · 1.5px #8A93A3 border, no fill
 *   focus      2px blue ring, 2px offset, always on
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer border-ghost data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:outline-ring flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] outline outline-2 outline-offset-2 outline-transparent transition-colors duration-[120ms] focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-70 data-[state=checked]:border-0',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-current')}>
      <Check className="h-3 w-3" strokeWidth={3.4} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
