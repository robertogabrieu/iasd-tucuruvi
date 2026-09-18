const PLAYLIST = 'PLcultos'

// O cache do YouTube vive no escopo do módulo, então cada caso precisa carregá-lo de novo.
async function carregarBuscador() {
  jest.resetModules()
  const { fetchYouTubePlaylist } = await import('../../server/lib/youtube')
  return fetchYouTubePlaylist
}

function itensDaPlaylist(ids: string[]) {
  const items = ids.map((id) => ({ snippet: { title: `Culto ${id}`, resourceId: { videoId: id } } }))
  return { ok: true, json: async () => ({ items }) } as Response
}

function situacaoDosVideos(situacao: Record<string, 'none' | 'live' | 'upcoming'>) {
  const items = Object.entries(situacao).map(([id, estado]) => ({
    id,
    snippet: { liveBroadcastContent: estado },
  }))
  return { ok: true, json: async () => ({ items }) } as Response
}

describe('fetchYouTubePlaylist', () => {
  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = 'chave-de-teste'
  })

  afterEach(() => {
    delete process.env.YOUTUBE_API_KEY
    jest.restoreAllMocks()
  })

  it('não lista a live que ainda está só agendada', async () => {
    const buscar = await carregarBuscador()
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(itensDaPlaylist(['agendada', 'passado1', 'passado2']))
      .mockResolvedValueOnce(situacaoDosVideos({ agendada: 'upcoming', passado1: 'none', passado2: 'none' }))

    const videos = await buscar(PLAYLIST, 4)

    expect(videos.map((v) => v.videoId)).toEqual(['passado1', 'passado2'])
  })

  it('mantém a live que está no ar agora', async () => {
    const buscar = await carregarBuscador()
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(itensDaPlaylist(['noar', 'passado']))
      .mockResolvedValueOnce(situacaoDosVideos({ noar: 'live', passado: 'none' }))

    const videos = await buscar(PLAYLIST, 4)

    expect(videos.map((v) => v.videoId)).toEqual(['noar', 'passado'])
  })

  it('mostra a lista sem filtrar quando não consegue saber quais são agendadas', async () => {
    const buscar = await carregarBuscador()
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(itensDaPlaylist(['a', 'b']))
      .mockResolvedValueOnce({ ok: false, status: 403 } as Response)

    const videos = await buscar(PLAYLIST, 4)

    expect(videos.map((v) => v.videoId)).toEqual(['a', 'b'])
  })
})
