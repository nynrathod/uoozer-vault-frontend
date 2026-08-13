import * as React from 'react'
import { cn } from '@lib/utils'

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  fallback?: string
  size?: 'sm' | 'default' | 'lg' | 'xl'
}

/** Displays an image or initial fallback inside a circular container. */
const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size = 'default', ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-8 w-8 text-xs',
      default: 'h-10 w-10 text-sm',
      lg: 'h-12 w-12 text-base',
      xl: 'h-16 w-16 text-lg',
    }

    const [error, setError] = React.useState(false)

    return (
      <div
        ref={ref}
        className={cn(
          'bg-primary/10 text-primary relative inline-flex items-center justify-center overflow-hidden rounded-full font-medium',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {src && !error ? (
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-cover"
            onError={() => setError(true)}
          />
        ) : (
          <span>{fallback?.charAt(0).toUpperCase() || '?'}</span>
        )}
      </div>
    )
  }
)
Avatar.displayName = 'Avatar'

export { Avatar }
