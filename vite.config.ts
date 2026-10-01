import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base + hash routing: dist/ can be served from any static path.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      // 'prompt': a waiting worker is only activated after the user accepts, never mid-cast.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: '地占沙盤',
        short_name: '地占沙盤',
        description: '繁體中文的西方地占起卦、盾盤與基礎象徵解讀（測試版）',
        lang: 'zh-Hant',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        background_color: '#F4EBDC',
        theme_color: '#725021',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        cleanupOutdatedCaches: true,
        // First install only: lets the open page become controlled without any reload.
        // skipWaiting stays off, so an updated worker still waits for the user.
        clientsClaim: true,
      },
    }),
  ],
  server: { port: 5173 },
  preview: { port: 4173, strictPort: true },
});
