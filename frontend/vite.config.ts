import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/parse': 'http://localhost:8000',
      '/analyze': 'http://localhost:8000',
      '/chat': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/settings': 'http://localhost:8000',
      '/schemas': 'http://localhost:8000',
      '/export': 'http://localhost:8000',
      '/auth': 'http://localhost:8000',
      '/integrations': 'http://localhost:8000',
    },
  },
})
