import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@lib/utils'

/** Wraps tooltip children with delay and collision settings. */
const TooltipProvider = TooltipPrimitive.Provider

/** Tooltip root — combine with TooltipTrigger and TooltipContent. */
const Tooltip = TooltipPrimitive.Root

/** Element that activates the tooltip on hover or focus. */
const TooltipTrigger = TooltipPrimitive.Trigger

/** Floating tooltip content rendered in a portal. */
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'bg-foreground text-background animate-scale-in z-50 overflow-hidden rounded-md px-3 py-1.5 text-xs shadow-md',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
