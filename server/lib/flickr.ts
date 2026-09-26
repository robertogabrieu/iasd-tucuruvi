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

interface FlickrApiPhoto {
  id: string
  title: string
  media?: string
  url_b?: string
  url_c?: string
  url_m?: string
}

const CACHE_TTL_MS = 3600_000
/**
 * O feed público entrega 20 fotos e a API vai a 500. Buscar sempre o máximo e fatiar por
 * requisição evita que a home (6 fotos) fixe o cache em 6 e a galeria inteira veja só isso —
 * e é o que dá ao sorteio um álbum inteiro para escolher, em vez das 20 mais recentes.
 */
const MAXIMO_POR_PAGINA = 500
/**
 * O álbum do clube passa de 1.500 fotos, e com uma página só o sorteio via apenas as 500
 * primeiras. Dez páginas cobrem 5.000 fotos por álbum, cacheadas por uma hora.
 */
const MAXIMO_DE_PAGINAS = 10
const cache = new Map<string, { data: FlickrPhoto[]; expiresAt: number }>()

async function comCache(
  chave: string,
  count: number,
  buscar: () => Promise<FlickrPhoto[]>,
): Promise<FlickrPhoto[]> {
  const now = Date.now()
  const cached = cache.get(chave)
  if (cached && now < cached.expiresAt) return cached.data.slice(0, count)

  try {
    const photos = await buscar()
    // Só guarda quando veio foto. Guardar uma resposta vazia deixava a galeria vazia pela
    // hora inteira do cache, mesmo com o álbum de volta no ar.
    if (photos.length) cache.set(chave, { data: photos, expiresAt: now + CACHE_TTL_MS })
    return photos.slice(0, count)
  } catch {
    return []
  }
}

export async function fetchFlickrFeed(url: string, count: number): Promise<FlickrPhoto[]> {
  return comCache(url, count, async () => {
    const res = await fetch(url)
    if (!res.ok) return []

    const data = await res.json()
    const items: FlickrFeedItem[] = data.items || []

    return items
      .filter((item) => !item.title.toLowerCase().includes('video'))
      .map((item) => ({
        src: item.media.m.replace('_m.jpg', '_b.jpg'),
        alt: item.title || 'IASD Tucuruvi',
        link: item.link,
      }))
  })
}

async function fetchViaApi(
  method: string,
  params: Record<string, string>,
  apiKey: string,
  link: (foto: FlickrApiPhoto) => string,
): Promise<FlickrPhoto[]> {
  const fotos: FlickrApiPhoto[] = []
  // Uma página que falha no meio encerra a busca com o que já veio: melhor sortear entre
  // parte do álbum do que deixar a galeria vazia.
  for (let pagina = 1; pagina <= MAXIMO_DE_PAGINAS; pagina++) {
    const query = new URLSearchParams({
      method,
      api_key: apiKey,
      format: 'json',
      nojsoncallback: '1',
      media: 'photos',
      extras: 'url_b,url_c,url_m,media',
      ...params,
      // Depois de params: quem pagina é este laço, e ninguém sobrescreve sem querer.
      per_page: String(MAXIMO_POR_PAGINA),
      page: String(pagina),
    })
    const res = await fetch(`https://api.flickr.com/services/rest/?${query}`)
    if (!res.ok) {
      console.warn(`[flickr] API ${res.status} em ${method}`)
      break
    }
    const body = (await res.json()) as {
      stat?: string
      message?: string
      photos?: { pages?: number; photo?: FlickrApiPhoto[] }
      photoset?: { pages?: number; photo?: FlickrApiPhoto[] }
    }
    if (body.stat !== 'ok') {
      console.warn(`[flickr] API recusou ${method}: ${body.message ?? 'sem motivo'}`)
      break
    }
    const lote = body.photos ?? body.photoset
    fotos.push(...(lote?.photo ?? []))
    if (pagina >= Number(lote?.pages ?? 1)) break
  }
  return fotos
    .filter((f) => f.media !== 'video')
    .map((f) => ({ src: f.url_b ?? f.url_c ?? f.url_m ?? '', alt: f.title || 'IASD Tucuruvi', link: link(f) }))
    .filter((f) => f.src !== '')
}

/**
 * As fotos de um álbum. Com FLICKR_API_KEY vem o álbum inteiro; sem ela, o feed público, que
 * só entrega as 20 mais recentes — o bastante para o site não ficar sem galeria em dev.
 */
export async function fetchFlickrAlbum(albumId: string, userId: string, count: number): Promise<FlickrPhoto[]> {
  const apiKey = process.env.FLICKR_API_KEY
  if (!apiKey) {
    const feed = `https://api.flickr.com/services/feeds/photoset.gne?set=${albumId}&nsid=${userId}&format=json&nojsoncallback=1`
    return fetchFlickrFeed(feed, count)
  }
  return comCache(`album:${albumId}`, count, () =>
    fetchViaApi(
      'flickr.photosets.getPhotos',
      { photoset_id: albumId, user_id: userId },
      apiKey,
      (f) => `https://www.flickr.com/photos/${userId}/${f.id}/in/set-${albumId}/`,
    ),
  )
}

/** As fotos públicas do perfil, fora de qualquer álbum. */
export async function fetchFlickrPhotostream(userId: string, count: number): Promise<FlickrPhoto[]> {
  const apiKey = process.env.FLICKR_API_KEY
  if (!apiKey) {
    const feed = `https://api.flickr.com/services/feeds/photos_public.gne?id=${userId}&format=json&nojsoncallback=1`
    return fetchFlickrFeed(feed, count)
  }
  return comCache(`perfil:${userId}`, count, () =>
    fetchViaApi(
      'flickr.people.getPublicPhotos',
      { user_id: userId },
      apiKey,
      (f) => `https://www.flickr.com/photos/${userId}/${f.id}/`,
    ),
  )
}

/** Embaralhamento de Fisher-Yates: `sort` com sorteio no comparador deixa as fotos quase paradas. */
export function embaralhado<T>(itens: T[]): T[] {
  const copia = [...itens]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

/**
 * As fotos de um ou mais álbuns, na ordem em que estão no Flickr, até o limite. Álbuns
 * seguidos, e não intercalados: cada evento aparece inteiro antes do próximo.
 */
export async function fetchAlbunsEmOrdem(albumIds: string[], userId: string, limite: number): Promise<FlickrPhoto[]> {
  const albuns = await Promise.all(albumIds.map((id) => fetchFlickrAlbum(id, userId, Infinity)))
  return albuns.flat().slice(0, limite)
}
