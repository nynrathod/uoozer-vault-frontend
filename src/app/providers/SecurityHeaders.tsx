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
    ensureMeta(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'wasm-unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self' https://*.r2.cloudflarestorage.com http://localhost:9000 ws://localhost:8080",
        "media-src 'self' blob:",
        "worker-src 'self' blob:",
        "frame-src 'self' blob:",
        "object-src 'self' blob:",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    )
  }, [])

  return null
}
