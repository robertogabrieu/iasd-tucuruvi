export interface FlickrPhoto {
  src: string
  alt: string
  link: string
}

interface FlickrFeedItem {
  title: string
  media: { m: string }
  link: string
}

const CACHE_TTL_MS = 3600_000
const cache = new Map<string, { data: FlickrPhoto[]; expiresAt: number }>()

export async function fetchFlickrFeed(url: string, count: number): Promise<FlickrPhoto[]> {
  const now = Date.now()
  const cached = cache.get(url)

  if (cached && now < cached.expiresAt) {
    return cached.data.slice(0, count)
  }

  try {
    const res = await fetch(url)
    if (!res.ok) return []

    const data = await res.json()
    const items: FlickrFeedItem[] = data.items || []

    const photos = items
      .filter((item) => !item.title.toLowerCase().includes('video'))
      .map((item) => ({
        src: item.media.m.replace('_m.jpg', '_b.jpg'),
        alt: item.title || 'IASD Tucuruvi',
        link: item.link,
      }))

    cache.set(url, { data: photos, expiresAt: now + CACHE_TTL_MS })

    return photos.slice(0, count)
  } catch {
    return []
  }
}
