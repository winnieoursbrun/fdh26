import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// https://vite.dev/config/
export default defineConfig({
  base: '/pdj/',
  build: {
    sourcemap: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // On enregistre le SW nous-mêmes via virtual:pwa-register (src/registerSW.ts)
      // pour catcher les échecs de register() au lieu de laisser une unhandled rejection.
      injectRegister: null,
      includeAssets: ['favicon.svg', 'map.png'],
      manifest: {
        name: 'Les Pluies de Juillet 2026',
        short_name: 'PDJ26',
        description:
          'Programme du festival Les Pluies de Juillet — 17, 18 et 19 juillet 2026 à Champrepus',
        lang: 'fr',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#f2ede2',
        background_color: '#f2ede2',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-api',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 8,
                maxAgeSeconds: 6 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
    // Uploads source maps to Sentry; no-ops when SENTRY_AUTH_TOKEN isn't set (e.g. local dev).
    // Must stay last in this array — Sentry's plugin needs to see the final build output.
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: 'winnietech',
            project: 'pdj-react',
            authToken: process.env.SENTRY_AUTH_TOKEN,
            sourcemaps: {
              filesToDeleteAfterUpload: ['./dist/**/*.map'],
            },
          }),
        ]
      : []),
  ],
})
