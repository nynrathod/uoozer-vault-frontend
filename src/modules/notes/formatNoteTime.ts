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
