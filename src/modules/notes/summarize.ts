function tidy(sentence: string): string {
  const trimmed = sentence.replace(/[.]+$/, '').trim()
  if (!trimmed) return ''
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

/** Browser-only summary. A network assistant can replace this without touching the editor. */
export function summarizeLocally(text: string, prompt: string, offset = 0): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) throw new Error('There is no text to summarize yet.')

  let parts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 12)

  if (parts.length < 2) {
    parts = cleaned
      .split(/,\s+/)
      .map((part) => part.trim())
      .filter((part) => part.length > 8)
  }
  if (parts.length === 0) throw new Error('There is no text to summarize yet.')

  const count = /\b(one|1)\b/i.test(prompt) ? 1 : /\b(five|5)\b/i.test(prompt) ? 5 : 3
  const bullets: string[] = []
  const seen = new Set<string>()
  for (let step = 0; step < parts.length && bullets.length < count; step += 1) {
    const line = tidy(parts[(offset + step) % parts.length] ?? '')
    if (!line || seen.has(line)) continue
    seen.add(line)
    bullets.push(line)
  }
  if (bullets.length === 0) throw new Error('There is no text to summarize yet.')
  return bullets
}
