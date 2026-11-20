import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@lib/utils'

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverAnchor = PopoverPrimitive.Anchor

/**
 * Floating content panel anchored to a PopoverTrigger.
 *
 * Design system (Foundations · Elevation): "Shadow replaces borders; nothing
 * else floats." Menus are radius 10 with the EXACT menu elevation
 * (0 8px 24px rgba(17,24,39,.12) + 1px rgba(17,24,39,.06) ring) — no border.
 * Pick the opening direction with `side`: "bottom" opens downward,
 * "top" opens upward (the account menu).
 */
const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'bg-popover text-popover-foreground animate-scale-in z-50 w-72 rounded-lg p-1.5 shadow-menu outline-none',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
