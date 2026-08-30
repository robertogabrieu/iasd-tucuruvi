import sharp from 'sharp'
import { renderEventoImage, encaixarInteiro } from '../../server/modules/eventos/eventos.image'
import { estiloClassico, estiloVibrante, estiloSobrio } from '../../server/modules/eventos/eventos.image.styles'
import type { EventoDTO } from '../../server/modules/eventos/dto/evento.dto'

const evento: EventoDTO = {
  id: '2f1c1a2e-0000-4000-8000-000000000001',
  title: 'Vigília de Oração dos Jovens',
  summary: 'Uma noite de louvor, oração e comunhão para toda a igreja.',
  description: { type: 'doc', content: [] },
  category: 'Jovens',
  startsAt: '2026-09-26T22:30:00.000Z',
  endsAt: null,
  locationName: 'Salão principal',
  locationAddress: 'R. Cruz de Malta, 1201',
  coverMode: 'foto',
  coverStyle: 'classico',
  accentColor: '#0055AA',
  secondaryColor: '#003366',
  hostName: 'Ana Beatriz Lima',
  hostRole: 'Líder do Ministério Jovem',
  hostPhotoMediaId: null,
  artMediaId: null,
  ctaLabel: 'Fazer inscrição',
  ctaUrl: 'https://exemplo.org/inscricao',
  status: 'published',
  slug: 'vigilia-de-oracao-dos-jovens',
  publicUrl: 'https://iasdtucuruvi.org.br/eventos/vigilia-de-oracao-dos-jovens',
  publishedAt: '2026-08-01T12:00:00.000Z',
}

const ESTILOS = ['classico', 'vibrante', 'sobrio'] as const

describe('renderEventoImage — tamanhos exatos', () => {
  it.each(ESTILOS)('card do estilo %s tem 1200×630 em PNG', async (coverStyle) => {
    const png = await renderEventoImage({ ...evento, coverStyle }, 'card')
    const meta = await sharp(png).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBe(1200)
    expect(meta.height).toBe(630)
  })

  it.each(ESTILOS)('story do estilo %s tem 1080×1920 em PNG', async (coverStyle) => {
    const png = await renderEventoImage({ ...evento, coverStyle }, 'story')
    const meta = await sharp(png).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBe(1080)
    expect(meta.height).toBe(1920)
  })

  it('mantém o tamanho quando a mídia da capa não existe mais no disco', async () => {
    const semArte: EventoDTO = { ...evento, coverMode: 'arte', artMediaId: '2f1c1a2e-0000-4000-8000-0000000000ff' }
    const meta = await sharp(await renderEventoImage(semArte, 'card')).metadata()
    expect(meta.width).toBe(1200)
    expect(meta.height).toBe(630)
  })
})

describe('encaixarInteiro — a arte pronta nunca é cortada', () => {
  const caixa = { x: 60, y: 40, largura: 400, altura: 510 }

  it('cabe inteira dentro da caixa mesmo sendo bem mais alta que larga', () => {
    const r = encaixarInteiro({ largura: 400, altura: 1600 }, caixa)
    expect(r.altura).toBe(510)
    expect(r.largura).toBeLessThanOrEqual(400)
    expect(r.largura / r.altura).toBeCloseTo(400 / 1600, 2)
  })

  it('cabe inteira dentro da caixa mesmo sendo bem mais larga que alta', () => {
    const r = encaixarInteiro({ largura: 2000, altura: 300 }, caixa)
    expect(r.largura).toBe(400)
    expect(r.altura).toBeLessThanOrEqual(510)
    expect(r.largura / r.altura).toBeCloseTo(2000 / 300, 2)
  })

  // A caixa é medida em pixels inteiros, então o centro pode ficar meio pixel deslocado.
  it('centraliza a arte na caixa', () => {
    const r = encaixarInteiro({ largura: 400, altura: 1600 }, caixa)
    expect(Math.abs(r.x + r.largura / 2 - (caixa.x + caixa.largura / 2))).toBeLessThanOrEqual(1)
    expect(Math.abs(r.y + r.altura / 2 - (caixa.y + caixa.altura / 2))).toBeLessThanOrEqual(1)
  })
})

describe('a cor do texto é calculada, nunca escolhida', () => {
  const dados = {
    categoria: 'Jovens',
    titulo: 'Vigília de Oração dos Jovens',
    quando: 'Sábado, 26 de setembro · 19h30',
    onde: 'Salão principal',
    cta: 'Fazer inscrição',
    modo: 'foto' as const,
  }
  const card = { largura: 1200, altura: 630 }

  /** O título é o único texto em peso 800; é nele que a trava de contraste aparece. */
  function corDoTitulo(svg: string): string | null {
    return /font-weight="800"[^>]*fill="(#[0-9A-Fa-f]{6})"/.exec(svg)?.[1] ?? null
  }

  it('clássico sobre secundária clara escreve em quase-preto', () => {
    const claro = estiloClassico({ ...dados, destaque: '#FFD400', secundaria: '#FEF3C7' }, card)
    expect(corDoTitulo(claro.texto)).toBe('#0A0A0A')
  })

  it('clássico sobre secundária escura escreve em branco', () => {
    const escuro = estiloClassico({ ...dados, destaque: '#0055AA', secundaria: '#003366' }, card)
    expect(corDoTitulo(escuro.texto)).toBe('#FFFFFF')
  })

  it('vibrante escolhe a cor legível sobre as duas pontas do gradiente', () => {
    const amarelo = estiloVibrante({ ...dados, destaque: '#FFD400', secundaria: '#FEF3C7' }, card)
    expect(corDoTitulo(amarelo.texto)).toBe('#0A0A0A')
    const azul = estiloVibrante({ ...dados, destaque: '#0055AA', secundaria: '#003366' }, card)
    expect(corDoTitulo(azul.texto)).toBe('#FFFFFF')
  })

  it('sóbrio troca o título quando a secundária some no fundo claro', () => {
    const somindo = estiloSobrio({ ...dados, destaque: '#0055AA', secundaria: '#FFFDF0' }, card)
    expect(corDoTitulo(somindo.texto)).toBe('#0A0A0A')
    const legivel = estiloSobrio({ ...dados, destaque: '#0055AA', secundaria: '#003366' }, card)
    expect(corDoTitulo(legivel.texto)).toBe('#003366')
  })

  it('o rótulo do botão contrasta com o fundo do próprio botão', () => {
    const capa = estiloClassico({ ...dados, destaque: '#FFD400', secundaria: '#4C1D95' }, card)
    expect(capa.texto).toContain('fill="#0A0A0A"')
  })
})
