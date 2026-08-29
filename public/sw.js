const CACHE_NAME = 'uoozer-vault-cache-v1'
const UPLOAD_QUEUE = 'uoozer-vault-upload-queue'

// ── Storage hosts to intercept for offline upload queueing ──
// Production: R2. Local dev: MinIO. Both are S3-compatible.
// Without MinIO entries here, the offline queue never engages in dev.
const STORAGE_HOSTS = ['r2.cloudflarestorage.com', 'localhost:9000', 'minio:9000', '127.0.0.1:9000']

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener('fetch', (event) => {
  const url = event.request.url
  const isStorageUpload =
    event.request.method === 'PUT' && STORAGE_HOSTS.some((host) => url.includes(host))

  if (isStorageUpload) {
    event.respondWith(handleStorageUpload(event.request))
  }
})

/**
 * Attempts the upload. On failure, saves the EXACT binary body to the
 * upload queue cache for later retry.
 *
 * CRITICAL FIX: The old code used event.request.clone().text() which
 * corrupts binary ciphertext — UTF-8 decode followed by re-encode changes
 * bytes that aren't valid UTF-8. The retried upload would send DIFFERENT
 * bytes than the original, silently corrupting the file in R2.
 *
 * Using .blob() preserves exact bytes end-to-end.
 */
async function handleStorageUpload(request) {
  try {
    const response = await fetch(request)
    if (!response.ok) throw new Error('Upload failed: ' + response.status)
    return response
  } catch (error) {
    // Clone as Blob — binary-safe, no UTF-8 corruption
    const blob = await request.clone().blob()
    await saveToQueue(request.url, blob)

    // Notify any open tabs
    const clients = await self.clients.matchAll()
    clients.forEach((client) => {
      client.postMessage({
        type: 'UPLOAD_QUEUED',
        url: request.url,
      })
    })

    return new Response(JSON.stringify({ error: 'Queued for background retry' }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * Stores a chunk's binary body in the Cache API for later retry.
 * Blob → Response preserves exact bytes.
 */
async function saveToQueue(url, blob) {
  const cache = await caches.open(UPLOAD_QUEUE)
  const response = new Response(blob, {
    headers: { 'Content-Type': 'application/octet-stream' },
  })
  await cache.put(url, response)
}

// ── Background retry: triggered by 'message' from the app or periodic sync ──
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'RETRY_QUEUED_UPLOADS') {
    await processUploadQueue()
  }
})

/**
 * Re-sends all queued uploads to R2/MinIO. Removes successful ones
 * from the queue. Failed ones remain for the next retry cycle.
 */
async function processUploadQueue() {
  const cache = await caches.open(UPLOAD_QUEUE)
  const requests = await cache.keys()

  for (const request of requests) {
    try {
      const response = await cache.match(request)
      if (!response) continue

      // Read as blob — binary-safe
      const blob = await response.blob()

      const retryResponse = await fetch(request.url, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'application/octet-stream' },
      })

      if (retryResponse.ok) {
        await cache.delete(request)

        // Notify the app this chunk succeeded on retry
        const clients = await self.clients.matchAll()
        clients.forEach((client) => {
          client.postMessage({
            type: 'UPLOAD_RETRY_SUCCESS',
            url: request.url,
          })
        })
      }
    } catch (e) {
      // Will retry again on next trigger
      console.error('SW: retry failed for', request.url, e)
    }
  }
}
