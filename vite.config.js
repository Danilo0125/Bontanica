import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    injectRegister: 'auto',
    includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
    manifest: {
      name: 'Botánica · Personal',
      short_name: 'Botánica',
      description: 'Caja, cocina y administración de Botánica RestoBar.',
      lang: 'es',
      dir: 'ltr',
      start_url: '/caja',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#ffffff',
      theme_color: '#8a6a22',
      categories: ['business', 'food', 'productivity'],
      icons: [
        { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      shortcuts: [
        { name: 'Mesero',  short_name: 'Mesero',  url: '/caja/mesero' },
        { name: 'Cocina',  short_name: 'Cocina',  url: '/caja/cocina' },
        { name: 'Admin',   short_name: 'Admin',   url: '/caja/admin' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      navigateFallback: '/index.html',
      // No interceptar Supabase ni el realtime — siempre red.
      navigateFallbackDenylist: [/^\/api/, /\/rest\//, /\/auth\//, /\/realtime\//, /\/storage\//],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts',
            expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: ({ url }) => url.pathname.startsWith('/assets/') || url.pathname.startsWith('/storage/v1/object/public/product-images/'),
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'images-and-assets',
            expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
          },
        },
        {
          // Supabase REST/Realtime/Auth: NetworkOnly (data live).
          urlPattern: /supabase\.co\/(rest|auth|realtime|storage)\/.*/i,
          handler: 'NetworkOnly',
        },
      ],
    },
    devOptions: {
      enabled: true,
      type: 'module',
      navigateFallback: 'index.html',
    },
  }), cloudflare()],
  server: { port: 5173, open: true },
  build: {
    outDir: 'dist',
    sourcemap: false, // No exponer el código fuente en prod (era 'true' antes).
    rollupOptions: {
      output: {
        // Chunks vendor explícitos para que el cliente cachee bien entre deploys.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
        },
      },
    },
  },
});