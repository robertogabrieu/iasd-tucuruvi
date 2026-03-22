const FLICKR_USER_ID = '198977834@N03'

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

export async function getFlickrPhotos(count: number = 20): Promise<FlickrPhoto[]> {
  try {
    const res = await fetch(
      `https://api.flickr.com/services/feeds/photos_public.gne?id=${FLICKR_USER_ID}&format=json&nojsoncallback=1`,
      { next: { revalidate: 3600 } } // cache 1 hour
    )

    if (!res.ok) return []

    const data = await res.json()
    const items: FlickrFeedItem[] = data.items || []

    return items
      .filter((item: FlickrFeedItem) => !item.title.toLowerCase().includes('video'))
      .slice(0, count)
      .map((item: FlickrFeedItem) => ({
        src: item.media.m.replace('_m.jpg', '_b.jpg'), // _b = large 1024px
        alt: item.title || 'IASD Tucuruvi',
        link: item.link,
      }))
  } catch {
    return []
  }
}
