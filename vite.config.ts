import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Porta da API do Express. Configurável porque vários agentes rodam o projeto em paralelo na
// mesma máquina, e a 3001 fica com quem chegou primeiro.
const api = `http://localhost:${process.env.API_PORT ?? 3001}`

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': api,
      '/media': api,
    },
  },
})
