const URL_ALBUM = 'https://api.flickr.com/services/feeds/photoset.gne?set=1&nsid=2'

const UMA_FOTO = {
  title: 'Foto do clube',
  media: { m: 'https://live.staticflickr.com/65535/1234_abcd_m.jpg' },
  link: 'https://www.flickr.com/photos/198977834@N03/1234/',
}

// O cache do Flickr vive no escopo do módulo, então cada caso precisa carregá-lo de novo.
async function carregarBuscador() {
  jest.resetModules()
  const { fetchFlickrFeed } = await import('../../server/lib/flickr')
  return fetchFlickrFeed
}

function responderCom(items: unknown[]) {
  return { ok: true, json: async () => ({ items }) } as Response
}

describe('fetchFlickrFeed', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('busca de novo depois de o Flickr responder sem foto nenhuma', async () => {
    const buscar = await carregarBuscador()
    const chamada = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(responderCom([]))
      .mockResolvedValueOnce(responderCom([UMA_FOTO]))

    // Primeira resposta veio vazia — acontece quando o Flickr limita ou o álbum oscila.
    expect(await buscar(URL_ALBUM, 12)).toHaveLength(0)

    // A galeria não pode ficar vazia até o cache expirar: a próxima visita tenta de novo.
    expect(await buscar(URL_ALBUM, 12)).toHaveLength(1)
    expect(chamada).toHaveBeenCalledTimes(2)
  })

  it('guarda o que veio com foto, para não buscar a cada visita', async () => {
    const buscar = await carregarBuscador()
    const chamada = jest.spyOn(global, 'fetch').mockResolvedValue(responderCom([UMA_FOTO]))

    expect(await buscar(URL_ALBUM, 12)).toHaveLength(1)
    expect(await buscar(URL_ALBUM, 12)).toHaveLength(1)
    expect(chamada).toHaveBeenCalledTimes(1)
  })

  it('entrega a foto no tamanho grande, não na miniatura do feed', async () => {
    const buscar = await carregarBuscador()
    jest.spyOn(global, 'fetch').mockResolvedValue(responderCom([UMA_FOTO]))

    const [foto] = await buscar(URL_ALBUM, 12)
    expect(foto.src).toContain('_b.jpg')
    expect(foto.alt).toBe('Foto do clube')
  })
})

const ALBUM = '72177720318202645'
const DONO = '198977834@N03'

async function carregarBuscadorDeAlbum() {
  jest.resetModules()
  const { fetchFlickrAlbum } = await import('../../server/lib/flickr')
  return fetchFlickrAlbum
}

function responderDaApi(photo: unknown[]) {
  return { ok: true, json: async () => ({ stat: 'ok', photoset: { photo } }) } as Response
}

describe('fetchFlickrAlbum', () => {
  afterEach(() => {
    delete process.env.FLICKR_API_KEY
    jest.restoreAllMocks()
  })

  it('pede o álbum inteiro à API quando há chave', async () => {
    process.env.FLICKR_API_KEY = 'chave-de-teste'
    const buscar = await carregarBuscadorDeAlbum()
    const chamada = jest.spyOn(global, 'fetch').mockResolvedValue(
      responderDaApi([{ id: '999', title: 'Formatura', url_b: 'https://live.staticflickr.com/1/999_a_b.jpg' }]),
    )

    const [foto] = await buscar(ALBUM, DONO, 6)

    expect(String(chamada.mock.calls[0][0])).toContain('per_page=500')
    expect(foto.src).toBe('https://live.staticflickr.com/1/999_a_b.jpg')
    expect(foto.link).toBe(`https://www.flickr.com/photos/${DONO}/999/in/set-${ALBUM}/`)
  })

  it('cai no feed público quando não há chave, para o site não ficar sem galeria', async () => {
    const buscar = await carregarBuscadorDeAlbum()
    const chamada = jest.spyOn(global, 'fetch').mockResolvedValue(responderCom([UMA_FOTO]))

    expect(await buscar(ALBUM, DONO, 6)).toHaveLength(1)
    expect(String(chamada.mock.calls[0][0])).toContain('/services/feeds/photoset.gne')
  })

  it('devolve vazio quando a API recusa a chave, em vez de quebrar a página', async () => {
    process.env.FLICKR_API_KEY = 'chave-vencida'
    const buscar = await carregarBuscadorDeAlbum()
    jest.spyOn(global, 'fetch').mockResolvedValue(
      { ok: true, json: async () => ({ stat: 'fail', message: 'Invalid API Key' }) } as Response,
    )

    expect(await buscar(ALBUM, DONO, 6)).toEqual([])
  })
})

describe('fetchAlbunsEmOrdem', () => {
  afterEach(() => {
    delete process.env.FLICKR_API_KEY
    jest.restoreAllMocks()
  })

  function fotosDaApi(prefixo: string, quantas: number) {
    return Array.from({ length: quantas }, (_, i) => ({
      id: `${prefixo}${i}`,
      title: `${prefixo}${i}`,
      url_b: `https://live.staticflickr.com/${prefixo}${i}_b.jpg`,
    }))
  }

  async function carregar() {
    jest.resetModules()
    const { fetchAlbunsEmOrdem } = await import('../../server/lib/flickr')
    return fetchAlbunsEmOrdem
  }

  it('mostra um álbum inteiro antes do seguinte, sem embaralhar', async () => {
    process.env.FLICKR_API_KEY = 'chave-de-teste'
    const buscar = await carregar()
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (url) =>
        responderDaApi(String(url).includes('photoset_id=A') ? fotosDaApi('a', 2) : fotosDaApi('b', 2)),
      )

    const fotos = await buscar(['A', 'B'], DONO, 60)
    expect(fotos.map((f) => f.alt)).toEqual(['a0', 'a1', 'b0', 'b1'])
  })

  it('para no limite, mesmo com álbum maior', async () => {
    process.env.FLICKR_API_KEY = 'chave-de-teste'
    const buscar = await carregar()
    jest.spyOn(global, 'fetch').mockResolvedValue(responderDaApi(fotosDaApi('a', 90)))

    expect(await buscar(['A'], DONO, 60)).toHaveLength(60)
  })
})

describe('embaralhado', () => {
  it('devolve os mesmos itens, sem perder nem repetir', async () => {
    jest.resetModules()
    const { embaralhado } = await import('../../server/lib/flickr')
    const original = Array.from({ length: 50 }, (_, i) => i)

    expect([...embaralhado(original)].sort((a, b) => a - b)).toEqual(original)
  })

  it('não deixa as fotos quase na ordem em que chegaram', async () => {
    jest.resetModules()
    const { embaralhado } = await import('../../server/lib/flickr')
    const original = Array.from({ length: 50 }, (_, i) => i)

    const noLugar = embaralhado(original).filter((n, i) => n === i).length

    expect(noLugar).toBeLessThan(10)
  })
})
