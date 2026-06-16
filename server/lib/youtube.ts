export interface YouTubeVideo {
  videoId: string
  title: string
}

const CACHE_TTL_MS = 3600_000
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

export async function fetchYouTubePlaylist(playlistId: string, count: number): Promise<YouTubeVideo[]> {
  const now = Date.now()
  const cached = cache.get(playlistId)

  if (cached && now < cached.expiresAt) {
    return cached.data.slice(0, count)
  }

  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`)
    if (!res.ok) return []

    const xml = await res.text()
    const videos: YouTubeVideo[] = []
    const entryRe = /<entry>([\s\S]*?)<\/entry>/g
    let m: RegExpExecArray | null
    while ((m = entryRe.exec(xml)) !== null) {
      const entry = m[1]
      const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
      const title = entry.match(/<title>([^<]*)<\/title>/)?.[1]
      if (id && title) {
        videos.push({ videoId: id, title: cleanTitle(decodeHtml(title)) })
      }
    }

    cache.set(playlistId, { data: videos, expiresAt: now + CACHE_TTL_MS })
    return videos.slice(0, count)
  } catch {
    return []
  }
}
