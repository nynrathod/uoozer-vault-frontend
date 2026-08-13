import { cn } from '@lib/utils'
import type { LucideIcon } from 'lucide-react'

interface IconContainerProps {
  icon: LucideIcon
  variant?: 'primary' | 'secondary' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function IconContainer({
  icon: Icon,
  variant = 'primary',
  size = 'lg',
  className,
}: IconContainerProps) {
  const sizeClasses = {
    sm: 'h-8 w-8 rounded-lg',
    md: 'h-10 w-10 rounded-xl',
    lg: 'h-14 w-14 rounded-2xl',
  }

  const variantClasses = {
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary text-muted-foreground/60',
    destructive: 'bg-destructive/10 text-destructive',
  }

  const iconSize = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-7 w-7',
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    >
      <Icon className={iconSize[size]} strokeWidth={1.8} />
    </div>
  )
}
