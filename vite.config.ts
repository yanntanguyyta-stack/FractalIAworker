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
        name: 'FractalIAworker · Markdown hiérarchique & IA contextuelle',
        short_name: 'FractalIAworker',
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
        // Function form: match by resolved id so subpath imports
        // (mammoth/mammoth.browser, pdfjs-dist/legacy/build/pdf, ...)
        // and unused listings can't break the grouping.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // NB: mermaid is intentionally NOT grouped here — its diagram
          // definitions are dynamic-imported and Vite naturally splits
          // them into lazy chunks; forcing them together would create
          // one 2 MB bundle.
          if (id.includes('pdfjs-dist')) return 'pdf'
          if (id.includes('mammoth') || id.includes('node_modules/docx/')) return 'docx'
          if (id.includes('@clerk/')) return 'clerk'
          if (id.includes('jszip')) return 'zip'
          if (id.includes('katex')) return 'katex'
          if (id.includes('lucide-react')) return 'icons'
          if (
            id.includes('react-markdown') ||
            id.includes('remark-') ||
            id.includes('rehype-') ||
            id.includes('mdast-') ||
            id.includes('node_modules/unified/')
          ) return 'markdown'
          if (id.includes('node_modules/react-dom/') || id.includes('node_modules/react/')) {
            return 'react-vendor'
          }
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
