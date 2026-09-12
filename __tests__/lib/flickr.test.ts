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
