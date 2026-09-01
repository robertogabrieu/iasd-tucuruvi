import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { fetchFlickrFeed } from './lib/flickr.js'
import { fetchYouTubePlaylist } from './lib/youtube.js'
import cookieParser from 'cookie-parser'
import { readFileSync } from 'fs'
import {
  authRoutes, roleRoutes, invitationAdminRoutes, invitationPublicRoutes, settingsRoutes, userRoutes, bootstrap,
  mediaAdminRoutes, mediaPublicRoutes, boletinsAdminRoutes, boletinsPublicRoutes, boletinsService, mediaService,
  eventosAdminRoutes, eventosPublicRoutes, eventosImageRoutes, eventosService,
  formsAdminRoutes, formsPublicRoutes,
} from './container.js'
import { injectOgTags } from './lib/og.js'
import { errorHandler } from './core/error-handler.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = Number(process.env.PORT) || 3001

app.use(express.json())
app.use(cookieParser())

// --- API Routes ---

const FLICKR_USER_ID = '198977834@N03'
const FLICKR_ALBUM_ID = '72177720318202645'

app.get('/api/flickr/album', async (_req, res) => {
  const count = Number(_req.query.count) || 20
  const random = _req.query.random === '1'
  const photos = await fetchFlickrFeed(
    `https://api.flickr.com/services/feeds/photoset.gne?set=${FLICKR_ALBUM_ID}&nsid=${FLICKR_USER_ID}&format=json&nojsoncallback=1`,
    random ? 100 : count
  )
  if (random) {
    const shuffled = [...photos].sort(() => Math.random() - 0.5)
    res.json(shuffled.slice(0, count))
    return
  }
  res.json(photos)
})

const YT_CULTOS_SABADO_PLAYLIST = 'PLwnLJcWxPcgSDNzfxjlhRC-3QC-3h2Atb'

app.get('/api/youtube/cultos', async (_req, res) => {
  const count = Number(_req.query.count) || 15
  const videos = await fetchYouTubePlaylist(YT_CULTOS_SABADO_PLAYLIST, count)
  res.json(videos)
})

app.get('/api/flickr/photos', async (_req, res) => {
  const count = Number(_req.query.count) || 20
  const photos = await fetchFlickrFeed(
    `https://api.flickr.com/services/feeds/photos_public.gne?id=${FLICKR_USER_ID}&format=json&nojsoncallback=1`,
    count
  )
  res.json(photos)
})

app.use('/api/auth', authRoutes)
app.use('/api/auth', invitationPublicRoutes) // aceite público de convite
app.use('/api/admin', invitationAdminRoutes)
app.use('/api/admin', roleRoutes)
app.use('/api/admin', settingsRoutes)
app.use('/api/admin', userRoutes)
app.use('/api/admin', mediaAdminRoutes)
app.use('/api/admin', boletinsAdminRoutes)
app.use('/api/admin', eventosAdminRoutes)
app.use('/api/admin', formsAdminRoutes)

// Motor de formulários (US-30): via única de entrada de todo formulário público do site.
app.use('/api/formularios', formsPublicRoutes)

app.use('/media', mediaPublicRoutes)
app.use('/api/boletins', boletinsPublicRoutes)
app.use('/api/eventos', eventosPublicRoutes)
app.use('/eventos', eventosImageRoutes)

// --- Static files (production) ---

if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '..', 'dist')
  app.use(express.static(distPath))

  // SSR só do <head>: injeta Open Graph no HTML do boletim publicado, antes do fallback SPA,
  // para o preview do WhatsApp (US-19). Boletim inexistente/rascunho cai no catch-all (404 no React).
  app.get('/boletins/:slug', async (req, res, next) => {
    try {
      const boletim = await boletinsService.getPublishedBySlug(String(req.params.slug))
      if (!boletim) return next()
      const html = readFileSync(path.join(distPath, 'index.html'), 'utf8')
      const base = process.env.PUBLIC_BASE_URL ?? ''
      let image = `${base}/img/logo-iasd.png`
      let imageType: string | undefined
      let imageWidth: number | undefined
      let imageHeight: number | undefined
      if (boletim.coverMediaId) {
        image = `${base}/media/${boletim.coverMediaId}`
        try {
          const m = await mediaService.getRaw(boletim.coverMediaId)
          imageType = m.mime_type
          imageWidth = m.width
          imageHeight = m.height
        } catch {
          // capa removida da biblioteca: segue só com a URL (sem dimensões).
        }
      }
      res.send(injectOgTags(html, {
        title: boletim.title,
        description: boletim.summary ?? '',
        image,
        url: `${base}/boletins/${boletim.slug}`,
        siteName: 'IASD Tucuruvi',
        imageType,
        imageWidth,
        imageHeight,
        imageAlt: boletim.title,
      }))
    } catch (err) {
      next(err)
    }
  })

  // Mesmo tratamento para o evento publicado: a imagem do cartão é a capa gerada em 1200x630
  // (US-29). Rascunho ou slug inexistente cai no catch-all e o React mostra 404.
  app.get('/eventos/:slug', async (req, res, next) => {
    try {
      const evento = await eventosService.getPublishedBySlug(String(req.params.slug))
      if (!evento) return next()
      const html = readFileSync(path.join(distPath, 'index.html'), 'utf8')
      const base = process.env.PUBLIC_BASE_URL ?? ''
      res.send(injectOgTags(html, {
        title: evento.title,
        description: evento.summary ?? '',
        image: `${base}/eventos/${evento.slug}/card.png`,
        url: `${base}/eventos/${evento.slug}`,
        siteName: 'IASD Tucuruvi',
        imageType: 'image/png',
        imageWidth: 1200,
        imageHeight: 630,
        imageAlt: evento.title,
      }))
    } catch (err) {
      next(err)
    }
  })

  app.get('{*path}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.use(errorHandler)

bootstrap()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
  })
  .catch((err) => {
    console.error('Falha no bootstrap (migrations/seed):', err)
    process.exit(1)
  })
