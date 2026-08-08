import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'
import fs from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// ─── Walk up from a file until we find a package.json with matching name ───
function findPackageRoot(entryFile: string, packageName: string): string {
  let dir = path.dirname(entryFile)
  while (dir !== path.parse(dir).root) {
    const pkgJsonPath = path.join(dir, 'package.json')
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))
        if (pkg.name === packageName) return dir
      } catch {
        /* ignore */
      }
    }
    dir = path.dirname(dir)
  }
  throw new Error(`Could not find root for ${packageName}`)
}

// ─── Auto-detect libsodium.mjs without touching restricted exports ─────────
function findLibsodiumMjs(): string {
  // 1. Try resolving libsodium directly (main entry is always exported)
  try {
    const sodiumMain = require.resolve('libsodium')
    const sodiumRoot = findPackageRoot(sodiumMain, 'libsodium')
    const candidate = path.join(sodiumRoot, 'dist', 'modules-esm', 'libsodium.mjs')
    if (fs.existsSync(candidate)) return candidate
  } catch {
    /* ignore */
  }

  // 2. Resolve libsodium-wrappers, then look for sibling/hoisted libsodium
  try {
    const wrappersMain = require.resolve('libsodium-wrappers')
    const wrappersRoot = findPackageRoot(wrappersMain, 'libsodium-wrappers')

    // 2a. Hoisted (same node_modules level)
    const hoisted = path.resolve(
      wrappersRoot,
      '..',
      'libsodium',
      'dist',
      'modules-esm',
      'libsodium.mjs'
    )
    if (fs.existsSync(hoisted)) return hoisted

    // 2b. Nested inside libsodium-wrappers' own node_modules
    const nested = path.join(
      wrappersRoot,
      'node_modules',
      'libsodium',
      'dist',
      'modules-esm',
      'libsodium.mjs'
    )
    if (fs.existsSync(nested)) return nested
  } catch {
    /* ignore */
  }

  throw new Error(
    'Could not find libsodium/dist/modules-esm/libsodium.mjs. ' +
      'Please ensure both libsodium and libsodium-wrappers are installed.'
  )
}

const LIBSODIUM_MJS = findLibsodiumMjs()

export default defineConfig({
  plugins: [
    // ─── FIX: redirect the broken relative import to the real file ─────────
    {
      name: 'fix-libsodium-wrappers',
      enforce: 'pre',
      resolveId(source, importer) {
        if (source === './libsodium.mjs' && importer?.includes('libsodium-wrappers')) {
          return LIBSODIUM_MJS
        }
      },
    },
    // ──────────────────────────────────────────────────────────────────────
    react(),
    tailwindcss(),
    tsconfigPaths(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'Uoozer Vault',
        short_name: 'Vault',
        description: 'Zero-knowledge encrypted file storage',
        theme_color: '#0a0a0f',
        background_color: '#0a0a0f',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ['libsodium-wrappers', 'libsodium'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2023',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['framer-motion', 'lucide-react', 'vaul'],
          query: ['@tanstack/react-query'],
          form: ['react-hook-form', 'zod', '@hookform/resolvers'],
        },
      },
    },
  },
})
