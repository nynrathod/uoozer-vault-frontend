import { cn } from '@lib/utils'

interface UserAvatarProps {
  email?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function UserAvatar({ email, size = 'md', className }: UserAvatarProps) {
  const sizeClasses = {
    sm: 'h-8 w-8 text-[12px]',
    md: 'h-10 w-10 text-[14px]',
    lg: 'h-16 w-16 text-xl',
  }

  return (
    <div
      className={cn(
        'bg-primary/10 text-primary flex items-center justify-center rounded-full font-semibold',
        sizeClasses[size],
        className
      )}
    >
      {email ? email.charAt(0).toUpperCase() : 'U'}
    </div>
  )
}
