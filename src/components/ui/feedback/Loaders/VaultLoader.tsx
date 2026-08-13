import { Shield } from 'lucide-react'
import { cn } from '@lib/utils'

/** Branded loading spinner with animated shield icon and progress bar. */
export function VaultLoader({ size = 40, className }: { size?: number; className?: string }) {
  // Uses CSS keyframe animations: spin (border rotation), pulse (icon opacity),
  // and vault-slide (progress bar indeterminate slide)
  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <div className="border-border absolute inset-0 rounded-lg border-2"></div>
        <div
          className="border-t-primary border-r-primary/50 absolute inset-0 rounded-lg border-2 border-transparent"
          style={{ animation: 'spin 0.6s linear infinite' }}
        ></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Shield
            className="text-primary"
            style={{
              width: size / 2.5,
              height: size / 2.5,
              animation: 'pulse 0.8s ease-in-out infinite',
            }}
          />
        </div>
      </div>
      <div className="bg-border h-[2px] w-12 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full w-1/2 rounded-full"
          style={{ animation: 'vault-slide 0.8s ease-in-out infinite' }}
        ></div>
      </div>
    </div>
  )
}
