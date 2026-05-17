import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-192.svg', 'pwa-512.svg'],
      workbox: {
        // Some vendor chunks (mermaid, pdfjs) exceed the 2 MiB default
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'FractalIA · Markdown hiérarchique & IA contextuelle',
        short_name: 'FractalIA',
        description: 'Éditeur Markdown fractal local-first avec assistants IA (Gemini, OpenAI)',
        theme_color: '#6366f1',
        background_color: '#f4f5fb',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: '/pwa-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          },
          {
            src: '/pwa-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    open: true
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-resizable-panels'],
          'clerk': ['@clerk/clerk-react'],
          'mermaid': ['mermaid'],
          'pdf': ['pdfjs-dist'],
          'docx': ['mammoth', 'docx'],
          'markdown': [
            'react-markdown',
            'remark-gfm',
            'remark-parse',
            'remark-stringify',
            'rehype-sanitize',
            'unified',
            'mdast-util-find-and-replace',
            'mdast-util-to-string',
          ],
          'zip': ['jszip'],
        },
      },
    },
  },
  esbuild: {
    target: 'es2022'
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022'
    }
  }
})
