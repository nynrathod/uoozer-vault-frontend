import type { CSSProperties } from 'react'
import { coverPresetById } from '../data/covers'

const PRESET_WIDTH: Record<string, number> = {
  waves: 900,
  sunrise: 820,
  moon: 820,
  circles: 1200,
  hills: 700,
}

export function NoteCover({
  value,
  className,
  style,
}: {
  value: string
  className?: string
  style?: CSSProperties
}) {
  const preset = coverPresetById(value)
  if (!preset) {
    return (
      <div
        className={className ?? 'note-cover-art'}
        style={{ background: value, height: 120, ...style }}
        aria-hidden="true"
      />
    )
  }
  const width = PRESET_WIDTH[preset.id] ?? 900
  return (
    <svg
      className={className ?? 'note-cover-art'}
      viewBox={`0 0 ${width} ${preset.height}`}
      preserveAspectRatio="none"
      style={{ height: preset.height, display: 'block', width: '100%', ...style }}
      role="img"
      aria-label={`Cover: ${preset.label}`}
    >
      <rect width={width} height={preset.height} fill={preset.bg} />
      {preset.shapes.map((shape, index) => {
        if (shape.t === 'rect') {
          return (
            <rect
              key={index}
              x={shape.x}
              y={shape.y}
              width={shape.w}
              height={shape.h}
              rx={shape.rx}
              fill={shape.fill}
              opacity={shape.o}
            />
          )
        }
        if (shape.t === 'circle') {
          return (
            <circle
              key={index}
              cx={shape.cx}
              cy={shape.cy}
              r={shape.r}
              fill={shape.fill}
              opacity={shape.o}
            />
          )
        }
        return <path key={index} d={shape.d} fill={shape.fill} opacity={shape.o} />
      })}
    </svg>
  )
}
