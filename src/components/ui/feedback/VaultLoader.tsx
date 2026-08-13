import { Shield } from 'lucide-react'
import { cn } from '@lib/utils'

interface VaultLoaderProps {
  size?: number
  className?: string
}

/** Spinning shield loader used during vault unlock and decryption. */
export function VaultLoader({ size = 40, className }: VaultLoaderProps) {
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

/** Animated bar-chart loader for file-processing states. */
export function ChunkStreamLoader({ size = 40, className }: VaultLoaderProps) {
  return (
    <div
      className={cn('flex items-center justify-center gap-1.5', className)}
      style={{ width: size, height: size * 0.6 }}
    >
      <div
        className="bg-primary/80 flex-1 rounded-sm"
        style={{ animation: 'chunk-scale 0.8s ease-in-out infinite', height: '100%' }}
      ></div>
      <div
        className="bg-primary flex-1 rounded-sm"
        style={{ animation: 'chunk-scale 0.8s ease-in-out 0.1s infinite', height: '100%' }}
      ></div>
      <div
        className="bg-primary/80 flex-1 rounded-sm"
        style={{ animation: 'chunk-scale 0.8s ease-in-out 0.2s infinite', height: '100%' }}
      ></div>
      <div
        className="bg-primary/60 flex-1 rounded-sm"
        style={{ animation: 'chunk-scale 0.8s ease-in-out 0.3s infinite', height: '100%' }}
      ></div>
    </div>
  )
}

/** Orbiting-dot loader evoking zero-knowledge/crypto operations. */
export function OrbitCoreLoader({ size = 40, className }: VaultLoaderProps) {
  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <div
        className="bg-primary/20 absolute inset-1/4 rounded-md"
        style={{ animation: 'pulse 1s ease-in-out infinite' }}
      ></div>

      <div className="absolute inset-0" style={{ animation: 'spin 0.8s linear infinite' }}>
        <div className="bg-primary absolute top-0 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full"></div>
      </div>

      <div className="absolute inset-0" style={{ animation: 'spin 1.2s linear reverse infinite' }}>
        <div className="bg-primary/50 absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"></div>
      </div>
    </div>
  )
}

/** Pulsing 3×3 grid loader for sync operations. */
export function PulseGridLoader({ size = 40, className }: VaultLoaderProps) {
  const cellSize = size / 3
  return (
    <div className={cn('grid grid-cols-3 gap-1', className)} style={{ width: size, height: size }}>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div
          key={i}
          className="bg-primary rounded-sm"
          style={{
            width: cellSize,
            height: cellSize,
            animation: 'grid-pulse 0.8s ease-in-out infinite',
            animationDelay: `${i * 0.05}s`,
          }}
        ></div>
      ))}
    </div>
  )
}
