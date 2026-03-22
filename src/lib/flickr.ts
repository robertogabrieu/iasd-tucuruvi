const FLICKR_USER_ID = '198977834@N03'
const FLICKR_ALBUM_ID = '72177720318202645' // 70 Anos de IASD Tucuruvi

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
  return fetchFlickrFeed(
    `https://api.flickr.com/services/feeds/photos_public.gne?id=${FLICKR_USER_ID}&format=json&nojsoncallback=1`,
    count
  )
}

export async function getFlickrAlbumPhotos(count: number = 20): Promise<FlickrPhoto[]> {
  return fetchFlickrFeed(
    `https://api.flickr.com/services/feeds/photoset.gne?set=${FLICKR_ALBUM_ID}&nsid=${FLICKR_USER_ID}&format=json&nojsoncallback=1`,
    count
  )
}

async function fetchFlickrFeed(url: string, count: number): Promise<FlickrPhoto[]> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })

    if (!res.ok) return []

    const data = await res.json()
    const items: FlickrFeedItem[] = data.items || []

    return items
      .filter((item: FlickrFeedItem) => !item.title.toLowerCase().includes('video'))
      .slice(0, count)
      .map((item: FlickrFeedItem) => ({
        src: item.media.m.replace('_m.jpg', '_b.jpg'),
        alt: item.title || 'IASD Tucuruvi',
        link: item.link,
      }))
  } catch {
    return []
  }
}
