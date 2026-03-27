interface FlickrPhoto {
  src: string
  alt: string
  link: string
}

interface FlickrFeedItem {
  title: string
  media: { m: string }
  link: string
}

let cache: { url: string; data: FlickrPhoto[]; expiresAt: number } | null = null

export async function fetchFlickrFeed(url: string, count: number): Promise<FlickrPhoto[]> {
  const now = Date.now()

  if (cache && cache.url === url && now < cache.expiresAt) {
    return cache.data.slice(0, count)
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

    cache = { url, data: photos, expiresAt: now + 3600_000 }

    return photos.slice(0, count)
  } catch {
    return []
  }
}
