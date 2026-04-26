// vite.config.ts
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Cache everything the app needs — JS, CSS, HTML, images, AND lesson JSONs
        globPatterns: ['**/*.{js,ts,css,html,ico,png,svg,webp,json}'],
      },
      manifest: {
        name:             'MentorAI',
        short_name:       'MentorAI',
        description:      'Offline-first AI study companion for grades 6–8',
        theme_color:      '#6C63FF',
        background_color: '#0D0D1A',
        display:          'standalone',
        start_url:        '/',
        icons: [
          { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  // Makes sure Vite can resolve imports from src/ and utils/
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});