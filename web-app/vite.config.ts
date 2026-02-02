import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws/devices': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
      '/voice-ws': {
        target: 'ws://localhost:3002',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/voice-ws/, '/ws'),
      },
    },
  },
})
