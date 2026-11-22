/* ============================================================================
 * LINK URL NORMALIZER — one matcher for every place a link is SAVED or
 * OPENED (bubble setLink, mobile format bar, click-to-open).
 *
 * The bug it kills: typing "example.com" stored an href WITHOUT a scheme,
 * and the DOM's `anchor.href` resolves that against the app origin — the
 * click opened "http://localhost:5173/example.com" ("localhost added to my
 * link"). With this helper the href always carries its real scheme, so the
 * browser opens exactly the link that was written and nothing else.
 * ==========================================================================*/

const SCHEMED = /^(https?:\/\/|mailto:|tel:)/i
/* In-app targets (anchors, root-relative paths) stay untouched — they are
   resolved by the app itself, never by a new tab. */
const IN_APP = /^(#|\/|\.\/|\.\.\/)/

export function normalizeLinkHref(raw: string): string {
  const value = raw.trim()
  if (!value) return value
  if (SCHEMED.test(value) || IN_APP.test(value)) return value
  return `https://${value}`
}
