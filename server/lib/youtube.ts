export interface YouTubeVideo {
  videoId: string
  title: string
}

const CACHE_TTL_MS = 3600_000
// Sempre busca o máximo da API (50) para o cache, independente do `count` pedido,
// e fatia por requisição. Sem isso, o primeiro chamador (ex.: home com count=4)
// fixaria o cache em 4 itens e /sermoes (count=12) só veria 4.
const CACHE_FETCH_COUNT = 50
const cache = new Map<string, { data: YouTubeVideo[]; expiresAt: number }>()

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

function cleanTitle(t: string): string {
  return t.replace(/\p{Extended_Pictographic}/gu, '').replace(/\s+/g, ' ').trim()
}

/**
 * Via oficial: YouTube Data API v3 (playlistItems.list). Funciona de qualquer IP, inclusive
 * datacenter/VPS. Exige YOUTUBE_API_KEY. maxResults vai até 50 por chamada.
 */
async function fetchViaDataApi(playlistId: string, count: number, apiKey: string): Promise<YouTubeVideo[]> {
  const max = Math.min(Math.max(count, 1), 50)
  const url =
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${max}` +
    `&playlistId=${encodeURIComponent(playlistId)}&key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url)
  if (!res.ok) {
    console.warn(`[youtube] Data API ${res.status} para playlist ${playlistId}`)
    return []
  }
  const body = (await res.json()) as {
    items?: { snippet?: { title?: string; resourceId?: { videoId?: string } } }[]
  }
  const videos: YouTubeVideo[] = []
  for (const item of body.items ?? []) {
    const id = item.snippet?.resourceId?.videoId
    const title = item.snippet?.title
    // Ignora itens privados/removidos (sem título útil).
    if (id && title && title !== 'Private video' && title !== 'Deleted video') {
      videos.push({ videoId: id, title: cleanTitle(title) })
    }
  }
  return withoutScheduledLives(videos, apiKey)
}

/**
 * Live agendada entra na playlist dias antes de acontecer, como vídeo que ainda não dá para
 * assistir. A playlist não diz quais são; videos.list diz (liveBroadcastContent = 'upcoming').
 * Se essa consulta falhar, devolve a lista inteira: melhor uma agendada na tela que nenhum vídeo.
 */
async function withoutScheduledLives(videos: YouTubeVideo[], apiKey: string): Promise<YouTubeVideo[]> {
  if (!videos.length) return videos
  const url =
    `https://www.googleapis.com/youtube/v3/videos?part=snippet&fields=items(id,snippet/liveBroadcastContent)` +
    `&id=${videos.map((v) => v.videoId).join(',')}&key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url).catch(() => null)
  if (!res?.ok) {
    console.warn(`[youtube] Data API ${res?.status ?? 'sem resposta'} ao consultar lives agendadas`)
    return videos
  }
  const body = (await res.json()) as { items?: { id?: string; snippet?: { liveBroadcastContent?: string } }[] }
  const scheduled = new Set(
    (body.items ?? []).filter((i) => i.snippet?.liveBroadcastContent === 'upcoming').map((i) => i.id),
  )
  return videos.filter((v) => !scheduled.has(v.videoId))
}

/**
 * Fallback sem chave: feed XML público. ATENÇÃO — o YouTube responde 404 para IPs de
 * datacenter/VPS, então em produção isso retorna vazio; serve sobretudo para o dev local.
 */
async function fetchViaFeed(playlistId: string): Promise<YouTubeVideo[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`)
  if (!res.ok) {
    console.warn(
      `[youtube] feed XML ${res.status} para playlist ${playlistId} ` +
        `(IPs de datacenter recebem 404 — configure YOUTUBE_API_KEY em produção).`,
    )
    return []
  }
  const xml = await res.text()
  const videos: YouTubeVideo[] = []
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g
  let m: RegExpExecArray | null
  while ((m = entryRe.exec(xml)) !== null) {
    const entry = m[1]
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
    const title = entry.match(/<title>([^<]*)<\/title>/)?.[1]
    if (id && title) videos.push({ videoId: id, title: cleanTitle(decodeHtml(title)) })
  }
  return videos
}

export async function fetchYouTubePlaylist(playlistId: string, count: number): Promise<YouTubeVideo[]> {
  const now = Date.now()
  const cached = cache.get(playlistId)
  if (cached && now < cached.expiresAt) {
    return cached.data.slice(0, count)
  }

  try {
    const apiKey = process.env.YOUTUBE_API_KEY
    const videos = apiKey
      ? await fetchViaDataApi(playlistId, CACHE_FETCH_COUNT, apiKey)
      : await fetchViaFeed(playlistId)

    // Só cacheia quando obteve algo, para não "fixar" vazio numa falha transitória.
    if (videos.length) cache.set(playlistId, { data: videos, expiresAt: now + CACHE_TTL_MS })
    return videos.slice(0, count)
  } catch (err) {
    console.warn('[youtube] falha ao buscar playlist:', err instanceof Error ? err.message : err)
    return []
  }
}
