import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { contatoSchema } from './lib/schemas.js'
import { sanitize } from './lib/sanitize.js'
import { rateLimit } from './lib/rate-limit.js'
import { sendContatoEmail } from './lib/mail.js'
import { fetchFlickrFeed } from './lib/flickr.js'

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
  const photos = await fetchFlickrFeed(
    `https://api.flickr.com/services/feeds/photoset.gne?set=${FLICKR_ALBUM_ID}&nsid=${FLICKR_USER_ID}&format=json&nojsoncallback=1`,
    count
  )
  res.json(photos)
})

app.get('/api/flickr/photos', async (_req, res) => {
  const count = Number(_req.query.count) || 20
  const photos = await fetchFlickrFeed(
    `https://api.flickr.com/services/feeds/photos_public.gne?id=${FLICKR_USER_ID}&format=json&nojsoncallback=1`,
    count
  )
  res.json(photos)
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
