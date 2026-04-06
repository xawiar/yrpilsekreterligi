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
    // MULTI-SW ARCHITECTURE:
    // This project uses THREE service workers that coexist without conflict:
    //   1. vite-plugin-pwa (generateSW) -- handles precaching of build assets and
    //      runtime caching (fonts, images, API). Registered automatically by the plugin.
    //   2. public/sw.js -- legacy manual SW for offline navigation fallback and
    //      push notification display. Registered by the app at runtime.
    //   3. public/firebase-messaging-sw.js -- dedicated FCM background message handler.
    //      Registered at /firebase-messaging-sw.js scope by fcmTokenManager.js.
    //
    // To prevent conflicts:
    //   - firebase-messaging-sw.js is excluded from precaching via globIgnores
    //   - sw.js is also excluded from precaching (it registers itself separately)
    //   - navigateFallbackDenylist prevents the workbox SW from intercepting the
    //     firebase-messaging-sw.js registration request
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192x192.png', 'icon-512x512.png'],
      manifest: {
        name: 'Sekreterlik Yönetim Sistemi',
        short_name: 'Sekreterlik',
        description: 'Parti sekreterlik yönetim sistemi',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'tr',
        dir: 'ltr',
        categories: ['productivity', 'business'],
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Üyeler',
            short_name: 'Üyeler',
            description: 'Üye listesini görüntüle',
            url: '/members',
            icons: [{ src: '/icon-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Etkinlikler',
            short_name: 'Etkinlikler',
            description: 'Etkinlikleri görüntüle',
            url: '/events',
            icons: [{ src: '/icon-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Toplantılar',
            short_name: 'Toplantılar',
            description: 'Toplantıları görüntüle',
            url: '/meetings',
            icons: [{ src: '/icon-192x192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Exclude manual service workers from precaching — they register themselves
        globIgnores: ['**/firebase-messaging-sw.js', '**/sw.js'],
        // Prevent workbox from intercepting SW registration requests
        navigateFallbackDenylist: [/^\/firebase-messaging-sw\.js$/, /^\/sw\.js$/],
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB - large bundle support
        runtimeCaching: [
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
      pure: ['console.log', 'console.info', 'console.debug', 'console.warn'],
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