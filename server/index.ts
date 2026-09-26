import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { embaralhado, fetchAlbunsEmOrdem, fetchFlickrAlbum, fetchFlickrPhotostream, type FlickrPhoto } from './lib/flickr.js'
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
  // No sorteio, o álbum inteiro entra no bolo: com só as primeiras, a home repetiria as
  // mesmas fotos a cada visita.
  const photos = await fetchFlickrAlbum(FLICKR_ALBUM_ID, FLICKR_USER_ID, random ? Infinity : count)
  res.json(random ? embaralhado(photos).slice(0, count) : photos)
})

// Álbum "Clube Vida e Saúde": o acervo do clube, indicado pela igreja no lugar do álbum
// de um evento só (a corrida Maranata 360), que repetia as fotos do mesmo dia.
const FLICKR_VIDASAUDE_ALBUM_ID = '72177720335761024'

app.get('/api/flickr/vidasaude', async (_req, res) => {
  const count = Number(_req.query.count) || 12
  const photos = await fetchFlickrAlbum(FLICKR_VIDASAUDE_ALBUM_ID, FLICKR_USER_ID, Infinity)
  res.json(embaralhado(photos).slice(0, count))
})

const YT_CULTOS_SABADO_PLAYLIST = 'PLwnLJcWxPcgSDNzfxjlhRC-3QC-3h2Atb'

app.get('/api/youtube/cultos', async (_req, res) => {
  const count = Number(_req.query.count) || 15
  const videos = await fetchYouTubePlaylist(YT_CULTOS_SABADO_PLAYLIST, count)
  res.json(videos)
})

// Envios do canal para o player "Últimos Vídeos". O player do YouTube apontado direto para
// essa playlist mostraria as lives agendadas; servida por aqui, ela chega já sem elas.
const YT_CANAL_ENVIOS_PLAYLIST = 'UUvtcRQ8TcPLZn5dP42bODFg'

app.get('/api/youtube/recentes', async (_req, res) => {
  const count = Number(_req.query.count) || 20
  const videos = await fetchYouTubePlaylist(YT_CANAL_ENVIOS_PLAYLIST, count)
  res.json(videos)
})

app.get('/api/flickr/photos', async (_req, res) => {
  const count = Number(_req.query.count) || 20
  res.json(await fetchFlickrPhotostream(FLICKR_USER_ID, count))
})

const FLICKR_ANTARES_ALBUMS = ['72177720322507560', '72177720318561272']
const FLICKR_KIDS_ALBUMS = ['72177720326030830']

/**
 * Sorteia entre as fotos de todos os álbuns do clube. Antes o carrossel intercalava as mais
 * recentes de cada um e acabava repetindo o mesmo evento a cada visita; com acervo grande, o
 * sorteio é o que faz a página mudar e também resolve o que a intercalação resolvia.
 */
async function fetchAlbunsDoClube(albumIds: string[], count: number): Promise<FlickrPhoto[]> {
  const results = await Promise.all(
    albumIds.map((id) => fetchFlickrAlbum(id, FLICKR_USER_ID, Infinity))
  )
  return embaralhado(results.flat()).slice(0, count)
}

app.get('/api/flickr/antares', async (_req, res) => {
  const count = Number(_req.query.count) || 12
  res.json(await fetchAlbunsDoClube(FLICKR_ANTARES_ALBUMS, count))
})

app.get('/api/flickr/aventureiros', async (_req, res) => {
  const count = Number(_req.query.count) || 12
  res.json(await fetchAlbunsDoClube(FLICKR_KIDS_ALBUMS, count))
})

// Abas da página Galeria: o álbum geral da igreja e o de cada departamento. Passando do
// limite, quem quiser ver mais segue para o álbum no Flickr.
const LIMITE_GALERIA = 60
// O álbum geral do clube, e não os dois de evento do carrossel da página: é ele que o botão
// "Ver todas as fotos" abre, e a aba mostra o começo do mesmo álbum.
const FLICKR_ANTARES_CLUBE_ALBUM_ID = '72177720318400790'
const ABAS_DA_GALERIA: Record<string, string[]> = {
  igreja: [FLICKR_ALBUM_ID],
  vidasaude: [FLICKR_VIDASAUDE_ALBUM_ID],
  desbravadores: [FLICKR_ANTARES_CLUBE_ALBUM_ID],
  aventureiros: FLICKR_KIDS_ALBUMS,
}

app.get('/api/flickr/galeria/:aba', async (req, res) => {
  // Só as chaves do próprio objeto: "constructor" e afins viriam do protótipo.
  if (!Object.prototype.hasOwnProperty.call(ABAS_DA_GALERIA, req.params.aba)) return res.status(404).json([])
  res.json(await fetchAlbunsEmOrdem(ABAS_DA_GALERIA[req.params.aba], FLICKR_USER_ID, LIMITE_GALERIA))
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
        image: `${base}/eventos/${evento.slug}/card.jpg`,
        url: `${base}/eventos/${evento.slug}`,
        siteName: 'IASD Tucuruvi',
        imageType: 'image/jpeg',
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
