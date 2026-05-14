import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  // Base path - production için root path kullan
  base: '/',
  
  plugins: [
    react(),
    // Production'da console.log/warn/info esbuild tarafından kaldırılır (aşağıda esbuild.drop)
    // PWA Plugin - Tam aktif
    //
    // MULTI-SW ARCHITECTURE (her biri farklı dosya adı + scope çakışmasız):
    //   1. vite-plugin-pwa (generateSW) -- /workbox-sw.js
    //      Precaching + runtime caching (fonts, images, API).
    //      Manuel register (main.jsx) — injectRegister: false.
    //      NOT: Şu an main.jsx workbox-sw.js'i register ETMİYOR — sadece /sw.js register ediliyor.
    //      Workbox cache faydası lazım olursa main.jsx'te ek register eklenebilir.
    //   2. public/sw.js -- ANA SW (push handler + offline navigation fallback).
    //      main.jsx içinde tek noktada register edilir, scope '/'.
    //   3. public/firebase-messaging-sw.js -- FCM background message handler.
    //      fcmTokenManager.js içinde register edilir, scope '/firebase-messaging-sw.js'.
    //
    // Çakışma engelleme:
    //   - filename: 'workbox-sw.js' — default 'sw.js' public/sw.js'i override etmesin
    //   - injectRegister: false — VitePWA otomatik register YAPMASIN
    //   - globIgnores ile sw.js + firebase-messaging-sw.js precache dışı
    //   - navigateFallbackDenylist ile workbox SW navigation interception engellenir
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192x192.png', 'icon-512x512.png'],
      // CRITICAL: Workbox SW dosya adını değiştir — public/sw.js'i override etmesin.
      // Default 'sw.js' olduğu için public/sw.js (custom push handler) build sırasında
      // workbox tarafından override ediliyordu. 'workbox-sw.js' ile çakışma çözüldü.
      filename: 'workbox-sw.js',
      // CRITICAL: VitePWA kendi register script'ini inject ETMESİN.
      // Tek register noktası: src/main.jsx → navigator.serviceWorker.register('/sw.js')
      injectRegister: false,
      // VitePWA'nın kendi manifest'ini DEVRE DIŞI bırak — static /public/manifest.json
      // (admin tarafından dinamik olarak Cloud Function üzerinden de override edilebilir)
      // tek manifest kaynağı için.
      manifest: false,
      workbox: {
        // manifest.json/webmanifest precache'e DAHIL ETME — dynamic Cloud Function'a yönlendirilir
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallbackDenylist: [/^\/manifest\.json$/, /^\/manifest\.webmanifest$/, /^\/firebase-messaging-sw\.js$/, /^\/sw\.js$/, /^\/workbox-sw\.js$/],
        // Exclude manual service workers from precaching — they register themselves
        globIgnores: ['**/firebase-messaging-sw.js', '**/sw.js'],
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB - large bundle support
        runtimeCaching: [
          {
            // index.html (navigation) — her zaman güncel, cache fallback
            // Deploy sonrası eski chunk isimlerini aramamak için kritik.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Static assets - Cache First
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Images - Cache First
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            // API requests - Network First (Firebase kullanılıyorsa)
            urlPattern: ({ url }) => {
              // Firebase isteklerini cache'leme
              if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) {
                return false;
              }
              return url.pathname.startsWith('/api');
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 // 1 hour
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              networkTimeoutSeconds: 10
            }
          }
        ]
      },
      devOptions: {
        enabled: false, // Development'ta PWA devre dışı (manuel SW kullanılıyor)
        type: 'module'
      }
    })
  ],
  
  // Build ayarları - Production için optimize
  build: {
    // Render.com için de dist klasörüne build et (Türkçe karakter sorunu için)
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // Production'da sourcemap kapalı
    minify: 'esbuild', // Hızlı minification
    // Production'da console.log ve console.warn kaldır (console.error Sentry için kalır)
    esbuild: {
      drop: ['debugger'],
      pure: ['console.log', 'console.info', 'console.debug'],
    },
    chunkSizeWarningLimit: 2000, // Increase limit to 2MB
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          'chart-vendor': ['recharts'],
          'export-vendor': ['xlsx', 'jspdf']
        }
      }
    }
  },
  
  server: {
    port: 5180,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  
  optimizeDeps: {
    include: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'crypto-js']
  },
  
  resolve: {
    alias: {}
  },
  
  // Preview ayarları (build test için)
  preview: {
    port: 4173,
    strictPort: true
  },

  // Vitest config
  test: {
    globals: true,
    environment: 'node',
  }
})