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
      // A capa e o story do evento são imagens geradas pelo servidor, e moram debaixo de
      // /eventos — o mesmo caminho da página pública. Sem esta linha o dev server devolve o
      // index.html no lugar do PNG, e o card do evento aparece sem imagem. Em produção não
      // acontece: lá quem serve as duas coisas é o Express.
      '^/eventos/[^/]+/(card|story)\\.png$': api,
    },
  },
})
