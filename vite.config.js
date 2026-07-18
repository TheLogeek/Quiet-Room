import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// NOTE on the model file: MediaPipe's LlmInference loads a .task model file
// (e.g. Gemma 3n E2B, ~1.5-3GB depending on quantization) from a URL you
// provide. For a true "works with no wifi" demo, you have two options:
//   1. Host the .task file yourself and let the service worker cache it
//      after first load (configured below).
//   2. Ship it from a CDN and just cache-first it — same effect.
// Either way, budget real time for this: the first load on a demo machine
// will be slow (downloading + WebGPU shader compilation). Pre-warm the
// cache before you go on stage.

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Standard app shell files
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Cache the large model file + wasm runtime with a cache-first
        // strategy so it only ever downloads once per device.
        runtimeCaching: [
          {
            urlPattern: /\.task$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gemma-model-cache',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /tasks-genai.*\.wasm$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mediapipe-wasm-cache',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'MindMirror',
        short_name: 'MindMirror',
        description: 'A private, on-device mental health journal',
        theme_color: '#1b1b1f',
        background_color: '#1b1b1f',
        display: 'standalone',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
