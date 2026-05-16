import { defineConfig, loadEnv } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Patrón del origen del API (VITE_API_URL) para cachear /uploads/* (fotos de productos). */
function uploadsUrlPattern(apiBase: string): RegExp {
  const fallback = 'http://localhost:8000'
  const raw = (apiBase || fallback).trim()
  let origin: string
  try {
    origin = new URL(raw.startsWith('http') ? raw : `http://${raw}`).origin
  } catch {
    origin = new URL(fallback).origin
  }
  return new RegExp(`^${escapeRegExp(origin)}\\/uploads\\/`)
}

function devHttpsEnabled(env: Record<string, string>): boolean {
  const v = String(env.VITE_DEV_HTTPS || '').toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const uploads = uploadsUrlPattern(env.VITE_API_URL || 'http://localhost:8000')
  const devHttps = mode === 'development' && devHttpsEnabled(env)

  return {
    plugins: [
      react(),
      ...(devHttps ? [basicSsl()] : []),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'pwa-maskable.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'El Lepra',
          short_name: 'El Lepra',
          description: 'Catálogo y administración de pedidos; panel admin con datos locales y sincronización.',
          lang: 'es',
          dir: 'ltr',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          theme_color: '#1a1a1a',
          background_color: '#1a1a1a',
          icons: [
            {
              src: '/favicon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,svg,png,webp,woff2,woff,ttf}'],
          navigateFallback: 'index.html',
          runtimeCaching: [
            {
              urlPattern: uploads,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'lepra-api-uploads',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 90,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'lepra-unsplash',
                expiration: {
                  maxEntries: 40,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: devHttps
      ? {
          host: true,
        }
      : undefined,
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            // React core (scheduler evita ciclos con otros paquetes UI)
            if (
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'react-vendor'
            }
            if (id.includes('node_modules/react-router')) return 'router'
            if (id.includes('node_modules/@tanstack/react-table')) return 'table'
            if (id.includes('node_modules/react-bootstrap') || id.includes('node_modules/bootstrap/')) {
              return 'ui-bootstrap'
            }
            if (id.includes('node_modules/react-select') || id.includes('node_modules/@emotion')) {
              return 'select-ui'
            }
            if (id.includes('node_modules/lucide-react')) return 'icons'
            if (id.includes('node_modules/dexie')) return 'dexie'
            return 'vendor'
          },
        },
      },
    },
  }
})
