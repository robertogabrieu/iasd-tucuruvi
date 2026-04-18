import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { contatoSchema } from './lib/schemas.js'
import { sanitize } from './lib/sanitize.js'
import { rateLimit } from './lib/rate-limit.js'
import { sendContatoEmail } from './lib/mail.js'
import { fetchFlickrFeed, type FlickrPhoto } from './lib/flickr.js'
import { fetchYouTubePlaylist } from './lib/youtube.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = Number(process.env.PORT) || 3001

app.use(express.json())

// --- API Routes ---

const limiter = rateLimit({ maxRequests: 5, windowMs: 60_000 })

app.post('/api/contato', async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown'

  if (!limiter.check(ip)) {
    res.status(429).json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' })
    return
  }

  const result = contatoSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dados inválidos.', details: result.error.flatten().fieldErrors })
    return
  }

  const data = {
    nome: sanitize(result.data.nome),
    telefone: sanitize(result.data.telefone),
    email: sanitize(result.data.email),
    horario: sanitize(result.data.horario),
  }

  try {
    await sendContatoEmail(data)
  } catch {
    res.status(500).json({ error: 'Erro ao enviar mensagem.' })
    return
  }

  res.json({ success: true, message: 'Mensagem enviada com sucesso!' })
})

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

const FLICKR_ANTARES_ALBUMS = ['72177720322507560', '72177720318561272']

app.get('/api/flickr/antares', async (_req, res) => {
  const count = Number(_req.query.count) || 12
  const perAlbum = Math.ceil(count / FLICKR_ANTARES_ALBUMS.length)
  const results = await Promise.all(
    FLICKR_ANTARES_ALBUMS.map((id) =>
      fetchFlickrFeed(
        `https://api.flickr.com/services/feeds/photoset.gne?set=${id}&nsid=${FLICKR_USER_ID}&format=json&nojsoncallback=1`,
        perAlbum
      )
    )
  )
  const merged: FlickrPhoto[] = []
  const maxLen = Math.max(...results.map((r) => r.length))
  for (let i = 0; i < maxLen; i++) {
    for (const album of results) {
      if (album[i]) merged.push(album[i])
    }
  }
  res.json(merged.slice(0, count))
})

// --- Static files (production) ---

if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '..', 'dist')
  app.use(express.static(distPath))
  app.get('{*path}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
