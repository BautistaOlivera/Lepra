import { defineConfig, loadEnv, type Plugin } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'fs'

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

/** Fuentes estándar de pdf.js, para pintar el comprobante sin el visor del navegador. */
function pdfjsStandardFonts(): Plugin {
  const fontsDir = path.resolve(__dirname, 'node_modules/pdfjs-dist/standard_fonts')
  return {
    name: 'pdfjs-standard-fonts',
    configureServer(server) {
      server.middlewares.use('/pdfjs/standard_fonts', (req, res, next) => {
        const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '')
        const file = path.resolve(fontsDir, rel)
        const fromRoot = path.relative(fontsDir, file)
        if (fromRoot.startsWith('..') || path.isAbsolute(fromRoot) || !existsSync(file) || !statSync(file).isFile()) {
          next()
          return
        }
        res.setHeader('Content-Type', 'application/octet-stream')
        createReadStream(file).pipe(res)
      })
    },
    generateBundle() {
      if (!existsSync(fontsDir)) return
      for (const name of readdirSync(fontsDir)) {
        const file = path.join(fontsDir, name)
        if (!statSync(file).isFile()) continue
        this.emitFile({
          type: 'asset',
          fileName: `pdfjs/standard_fonts/${name}`,
          source: readFileSync(file),
        })
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const uploads = uploadsUrlPattern(env.VITE_API_URL || 'http://localhost:8000')
  const apiBase = (env.VITE_API_URL || 'http://localhost:8000').trim()
  let apiOrigin = 'http://localhost:8000'
  try {
    apiOrigin = new URL(apiBase.startsWith('http') ? apiBase : `http://${apiBase}`).origin
  } catch {
    /* keep fallback */
  }
  const pdfLogoPattern = new RegExp(`^${escapeRegExp(apiOrigin)}\\/uploads\\/lepra-logo-watermark\\.png$`)
  const devHttps = mode === 'development' && devHttpsEnabled(env)

  return {
    plugins: [
      react(),
      pdfjsStandardFonts(),
      ...(devHttps ? [basicSsl()] : []),
      VitePWA({
        // 'prompt': la app avisa cuando hay versión nueva (botón "Actualizar").
        // Si el usuario ignora el aviso, el SW nuevo queda en espera y se activa
        // solo al cerrar y volver a abrir la app (mismo efecto que autoUpdate).
        registerType: 'prompt',
        // Sin registerSW.js en el HTML: lo registramos desde la app (evita carrera con Android 4.x).
        injectRegister: false,
        includeAssets: [
          'favicon.png',
          'apple-touch-icon.png',
          'pwa-icon-192.png',
          'pwa-icon-512.png',
          'pwa-maskable-512.png',
        ],
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
              src: '/pwa-icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: [
            'index.html',
            'manifest.webmanifest',
            'favicon.png',
            'apple-touch-icon.png',
            'pwa-icon-192.png',
            'pwa-icon-512.png',
            'pwa-maskable-512.png',
            'pdfjs/standard_fonts/*',
          ],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          // El SW nuevo espera (no skipWaiting): se activa con el botón
          // "Actualizar" del aviso, o al cerrar y reabrir la app.
          skipWaiting: false,
          navigateFallback: 'index.html',
          runtimeCaching: [
            {
              urlPattern: pdfLogoPattern,
              handler: 'NetworkOnly',
            },
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
      legacy({
        targets: ['chrome >= 81', 'android >= 4.4'],
        renderModernChunks: false,
        additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
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
      target: 'es2018',
      cssTarget: 'chrome81',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
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
            if (id.includes('node_modules/pdfjs-dist')) return 'pdfjs'
            return 'vendor'
          },
        },
      },
    },
  }
})
