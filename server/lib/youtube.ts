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
    // Scrape the playlist HTML page (ytInitialData JSON). The RSS feed
    // (/feeds/videos.xml) has been returning 404 from server environments.
    const res = await fetch(`https://www.youtube.com/playlist?list=${playlistId}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    })
    if (!res.ok) return []

    const html = await res.text()
    const videos: YouTubeVideo[] = []
    const seen = new Set<string>()
    const re = /"playlistVideoRenderer":\{"videoId":"([^"]+)"[\s\S]{0,2000}?"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      const id = m[1]
      if (seen.has(id)) continue
      seen.add(id)
      // Unescape JSON string literals (\" \\ \n \/ \uXXXX)
      const rawTitle = m[2].replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
        String.fromCharCode(parseInt(h, 16))
      ).replace(/\\(.)/g, '$1')
      videos.push({ videoId: id, title: cleanTitle(decodeHtml(rawTitle)) })
    }

    cache.set(playlistId, { data: videos, expiresAt: now + CACHE_TTL_MS })
    return videos.slice(0, count)
  } catch {
    return []
  }
}
