import { useEffect } from 'react'

export function SecurityHeaders() {
  useEffect(() => {
    const ensureMeta = (name: string, content: string) => {
      let meta = document.querySelector(`meta[http-equiv="${name}"]`)
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute('http-equiv', name)
        document.head.appendChild(meta)
      }
      meta.setAttribute('content', content)
    }

    ensureMeta('X-Content-Type-Options', 'nosniff')
    ensureMeta('X-Frame-Options', 'DENY')
    ensureMeta('Referrer-Policy', 'strict-origin-when-cross-origin')
  }, [])

  return null
}
