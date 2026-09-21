type HashFn = (data: Uint8Array) => Buffer
let hashFn: HashFn | null = null

// known BLAKE3("") digest — verifies whichever library loads actually computes BLAKE3
const BLAKE3_EMPTY = 'af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262'

export async function initBlake3(): Promise<void> {
  if (hashFn) return

  const candidates: Array<() => Promise<HashFn>> = [
    async () => {
      const m: any = await import('@noble/hashes')
      if (typeof m.blake3 !== 'function') throw new Error('x')
      return (d) => Buffer.from(m.blake3(d))
    },
    async () => {
      const m: any = await import(/* @vite-ignore */ '@noble/hashes/blake3.js' as string)
      if (typeof m.blake3 !== 'function') throw new Error('x')
      return (d) => Buffer.from(m.blake3(d))
    },
    async () => {
      const m: any = await import(/* @vite-ignore */ '@noble/hashes/blake3' as string)
      if (typeof m.blake3 !== 'function') throw new Error('x')
      return (d) => Buffer.from(m.blake3(d))
    },
    async () => {
      const m: any = await import('hash-wasm')
      const h = await m.createBLAKE3()
      if (typeof h !== 'function') throw new Error('x')
      return (d) => Buffer.from(h(d), 'hex')
    },
  ]

  for (const c of candidates) {
    try {
      const fn = await c()
      if (fn(new Uint8Array(0)).toString('hex') === BLAKE3_EMPTY) {
        hashFn = fn
        return
      }
    } catch {
      /* try next */
    }
  }
  throw new Error('no working blake3 found — run: yarn add -D hash-wasm@4')
}

export function blake3Hex(data: Buffer): string {
  if (!hashFn) throw new Error('call await initBlake3() first')
  return hashFn(new Uint8Array(data)).toString('hex')
}
