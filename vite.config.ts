import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('./src/dashboard', import.meta.url))
const outDir = fileURLToPath(new URL('./dist/dashboard', import.meta.url))

export default defineConfig({
  root,
  base: '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': root,
    },
  },
  build: {
    outDir,
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      // In dev, proxy REST + SSE to the aideck backend on 7777 so React
      // components can hit `/api/...` directly with no CORS dance.
      '/api': {
        target: 'http://127.0.0.1:7777',
        changeOrigin: false,
      },
      '/sse': {
        target: 'http://127.0.0.1:7777',
        changeOrigin: false,
      },
    },
  },
})
