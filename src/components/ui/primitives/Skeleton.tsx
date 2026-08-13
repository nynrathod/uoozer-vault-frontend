import { cn } from '@lib/utils'

/** Props for the Skeleton placeholder component. */
interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

/** Animated placeholder box shown while content is loading. */
function Skeleton({ className, ...props }: SkeletonProps) {
  return <div className={cn('bg-muted animate-pulse rounded-md', className)} {...props} />
}

export { Skeleton }
