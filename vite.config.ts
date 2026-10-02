import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path from 'path'

// Porta da API do Express. Configurável porque vários agentes rodam o projeto em paralelo na
// mesma máquina, e a 3001 fica com quem chegou primeiro.
const api = `http://localhost:${process.env.API_PORT ?? 3001}`

// Só o deploy tem o token e o projeto do Sentry. Sem os dois não se gera mapa nenhum: o mapa
// entrega o código-fonte, e o que não sobe para o Sentry acabaria servido junto com o site.
const sentryToken = process.env.SENTRY_AUTH_TOKEN
const enviaMapasAoSentry = Boolean(sentryToken && process.env.SENTRY_PROJECT)

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: 'roberto-almeida-developer',
      project: process.env.SENTRY_PROJECT,
      authToken: sentryToken,
      release: { name: process.env.SENTRY_RELEASE || undefined },
      sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      telemetry: false,
      // Sentry fora do ar não pode impedir o site de ir para produção: avisa e segue.
      errorHandler: (erro) => console.warn(erro),
    }),
  ],
  build: {
    sourcemap: enviaMapasAoSentry ? 'hidden' : false,
  },
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
      // index.html no lugar da imagem, e o card do evento aparece sem imagem. Em produção não
      // acontece: lá quem serve as duas coisas é o Express. O card.png antigo só redireciona.
      '^/eventos/[^/]+/(card\\.(jpg|png)|story\\.png)$': api,
    },
  },
})
