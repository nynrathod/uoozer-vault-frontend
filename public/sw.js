const CACHE_NAME = 'uoozer-vault-cache-v1'
const UPLOAD_QUEUE = 'uoozer-upload-queue'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method === 'PUT' && event.request.url.includes('r2.cloudflarestorage.com')) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(event.request)
          if (!response.ok) throw new Error('Upload failed in SW')
          return response
        } catch (error) {
          const body = await event.request.clone().text()
          await saveToQueue(event.request.url, body)
          return new Response(JSON.stringify({ error: 'Queued for background retry' }), {
            status: 202,
          })
        }
      })()
    )
  }
})

async function saveToQueue(url, body) {
  const cache = await caches.open(UPLOAD_QUEUE)
  const response = new Response(body)
  await cache.put(url, response)
}
