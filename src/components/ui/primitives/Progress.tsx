import * as React from 'react'
import { cn } from '@lib/utils'

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  size?: 'sm' | 'default' | 'lg'
  variant?: 'default' | 'success' | 'warning' | 'error'
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, max = 100, size = 'default', variant = 'default', ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100))

    const sizeClasses = {
      sm: 'h-1',
      default: 'h-1.5',
      lg: 'h-2.5',
    }

    const variantClasses = {
      default: 'bg-primary',
      success: 'bg-emerald-500',
      warning: 'bg-amber-500',
      error: 'bg-red-500',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'bg-secondary relative w-full overflow-hidden rounded-full',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-out',
            variantClasses[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    )
  }
)
Progress.displayName = 'Progress'

export { Progress }
