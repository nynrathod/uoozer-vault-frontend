/** Relative timestamps for the list pane ("Just now", "Mon", "Nov 12"). */
export function formatNoteTime(iso: string, now = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const diff = now.getTime() - date.getTime()
  if (diff < 60_000) return 'Just now'
  if (date.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
  }
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)
  }
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

/** Long form for the editor header ("Nov 20, 2026, 4:05 PM"). */
export function formatNoteFullTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

/** "in 49 days" / "in 3 h" for the time-capsule block. */
export function formatCountdown(target: Date, now = new Date()): string {
  const ms = target.getTime() - now.getTime()
  if (ms <= 0) return 'open'
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000))
  if (days >= 1) return `in ${days} ${days === 1 ? 'day' : 'days'}`
  const hours = Math.ceil(ms / (60 * 60 * 1000))
  if (hours >= 1) return `in ${hours} h`
  return 'soon'
}

/** "Jan 1, 2027" for sealed-until labels. */
export function formatSealDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}
