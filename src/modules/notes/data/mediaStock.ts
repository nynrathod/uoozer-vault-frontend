export interface StockPhoto {
  id: string
  label: string
  /** Full-resolution source inserted into the note. */
  src: string
  /** Small preview used inside the picker grid. */
  thumb: string
}

export const UNSPLASH_PICKS: StockPhoto[] = [
  {
    id: 'mountains',
    label: 'Mountains',
    src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=240&q=60',
  },
  {
    id: 'forest',
    label: 'Forest',
    src: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=240&q=60',
  },
  {
    id: 'fog',
    label: 'Foggy hills',
    src: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=240&q=60',
  },
  {
    id: 'lake',
    label: 'Lake cabin',
    src: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=240&q=60',
  },
  {
    id: 'night-sky',
    label: 'Night sky',
    src: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=240&q=60',
  },
  {
    id: 'waterfall',
    label: 'Waterfall',
    src: 'https://images.unsplash.com/photo-1433086966358-54859d0ee7a8?w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1433086966358-54859d0ee7a8?w=240&q=60',
  },
  {
    id: 'leaves',
    label: 'Green leaves',
    src: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=240&q=60',
  },
  {
    id: 'field',
    label: 'Open field',
    src: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=240&q=60',
  },
  {
    id: 'bridge',
    label: 'Golden Gate',
    src: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=240&q=60',
  },
]

/**
 * Normalizes anything giphy-shaped into a direct GIF URL. Returns '' when
 * the value is not a giphy link (the caller falls back to the raw value).
 */
export function normalizeGiphy(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  const idMatch =
    value.match(/giphy\.com\/(?:gifs|media)\/(?:.*-)?([a-zA-Z0-9]+)(?:\/)?$/) ??
    value.match(/media\.giphy\.com\/media\/([a-zA-Z0-9]+)/)
  if (idMatch?.[1]) return `https://media.giphy.com/media/${idMatch[1]}/giphy.gif`
  return ''
}
