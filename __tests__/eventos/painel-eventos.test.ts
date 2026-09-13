import { faltaParaPublicar } from '../../server/modules/eventos/eventos.publish-rules'
import type { EventoDTO } from '../../server/modules/eventos/dto/evento.dto'
import {
  cartaoDaPendencia,
  dataDoEvento,
  dataLongaDoEvento,
  deCampoDeDataHora,
  mensagemDeCompartilhamento,
  novaSessaoDeFormulario,
  paraCampoDeDataHora,
  sessaoDaApiParaFormulario,
  sessaoDoFormularioParaApi,
  sessoesPreenchidas,
} from '@/painel/eventos-api'

const base: EventoDTO = {
  id: '2f1c1a2e-0000-4000-8000-000000000001',
  title: 'Vigília de Oração dos Jovens',
  summary: 'Uma noite de oração',
  description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Venha participar.' }] }] },
  category: 'Jovens',
  startsAt: '2026-09-26T22:30:00.000Z',
  endsAt: '2026-09-27T01:00:00.000Z',
  locationName: 'Igreja Adventista do Tucuruvi',
  locationAddress: 'R. Cruz de Malta, 1201',
  coverMode: 'foto',
  coverStyle: 'classico',
  accentColor: '#0055AA',
  secondaryColor: '#003366',
  hostName: 'Pr. João',
  hostRole: 'Pastor distrital',
  hostPhotoMediaId: '2f1c1a2e-0000-4000-8000-000000000002',
  artMediaId: null,
  ctaLabel: 'Confirmar presença',
  ctaUrl: 'https://exemplo.org/inscricao',
  status: 'published',
  slug: 'vigilia-de-oracao-dos-jovens',
  publicUrl: 'https://iasdtucuruvi.org.br/eventos/vigilia-de-oracao-dos-jovens',
  publishedAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
  sessions: [{
    id: '2f1c1a2e-0000-4000-8000-000000000003',
    startsAt: '2026-09-26T22:30:00.000Z',
    endsAt: '2026-09-27T01:00:00.000Z',
    title: null,
    description: null,
  }],
}

/** Primeira (e única) mensagem que o servidor produz para um evento com esse defeito. */
function pendencia(defeito: Partial<EventoDTO>): string {
  const falta = faltaParaPublicar({ ...base, ...defeito })
  expect(falta).toHaveLength(1)
  return falta[0]
}

// O formulário não só mostra o que falta: ele leva ao cartão que falta. O mapeamento roda sobre
// as frases que o servidor devolve de verdade, então mudou a frase lá, este teste acusa.
describe('cartaoDaPendencia', () => {
  it('manda o título e a descrição para o cartão "Sobre o evento"', () => {
    expect(cartaoDaPendencia(pendencia({ title: '  ' }))).toBe('sobre')
    expect(cartaoDaPendencia(pendencia({ description: { type: 'doc', content: [] } }))).toBe('sobre')
  })

  it('manda horário, local e término inválido para o cartão "Quando e onde"', () => {
    expect(cartaoDaPendencia(pendencia({ sessions: [] }))).toBe('quando')
    expect(cartaoDaPendencia(pendencia({ locationName: '' }))).toBe('quando')
    const terminoAntes = { ...base.sessions[0], endsAt: '2026-09-26T20:00:00.000Z' }
    expect(cartaoDaPendencia(pendencia({ sessions: [terminoAntes] }))).toBe('quando')
  })

  it('as pendências de programação levam ao cartão de horários', () => {
    expect(cartaoDaPendencia('Informe pelo menos um horário para o evento.')).toBe('quando')
    expect(cartaoDaPendencia('No 2º horário, o término precisa ser depois do início.')).toBe('quando')
  })

  it('manda nome, função e foto para o cartão "Responsável"', () => {
    expect(cartaoDaPendencia(pendencia({ hostName: null }))).toBe('responsavel')
    expect(cartaoDaPendencia(pendencia({ hostRole: null }))).toBe('responsavel')
    expect(cartaoDaPendencia(pendencia({ hostPhotoMediaId: null }))).toBe('responsavel')
  })

  it('manda a arte pronta para o cartão "Capa"', () => {
    const falta = pendencia({ coverMode: 'arte', artMediaId: null, hostPhotoMediaId: null })
    expect(cartaoDaPendencia(falta)).toBe('capa')
  })

  it('manda o par texto/link para o cartão "Botão de ação"', () => {
    expect(cartaoDaPendencia(pendencia({ ctaUrl: null }))).toBe('acao')
  })

  it('cai no primeiro cartão quando a frase é desconhecida', () => {
    expect(cartaoDaPendencia('Alguma regra nova do servidor.')).toBe('sobre')
  })
})

describe('datas do evento', () => {
  it('mostra a data na hora de São Paulo, onde o evento acontece', () => {
    expect(dataDoEvento(base.startsAt)).toBe('26/09/2026, 19:30')
    expect(dataLongaDoEvento(base.startsAt)).toBe('sábado, 26 de setembro de 2026 às 19:30')
  })

  it('leva o instante para o campo de data e hora e traz de volta sem deslocar', () => {
    expect(paraCampoDeDataHora(base.startsAt)).toBe('2026-09-26T19:30')
    expect(deCampoDeDataHora('2026-09-26T19:30')).toBe('2026-09-26T22:30:00.000Z')
  })

  it('leva um horário da API ao formulário e de volta, com e sem horário de verão', () => {
    // 15/12/2018: São Paulo ainda tinha horário de verão (UTC-2); 26/09/2026 não tem (UTC-3).
    const verao = { ...base.sessions[0], startsAt: '2018-12-15T22:00:00.000Z', endsAt: '2018-12-16T00:30:00.000Z', title: 'Abertura', description: 'Louvor.' }
    const noFormulario = sessaoDaApiParaFormulario(verao)
    expect(noFormulario).toMatchObject({ inicio: '2018-12-15T20:00', termino: '2018-12-15T22:30', title: 'Abertura', description: 'Louvor.' })
    expect(sessaoDoFormularioParaApi(noFormulario)).toEqual({
      startsAt: '2018-12-15T22:00:00.000Z', endsAt: '2018-12-16T00:30:00.000Z', title: 'Abertura', description: 'Louvor.',
    })

    const semVerao = sessaoDaApiParaFormulario(base.sessions[0])
    expect(semVerao).toMatchObject({ inicio: '2026-09-26T19:30', termino: '2026-09-26T22:00', title: '', description: '' })
    expect(sessaoDoFormularioParaApi(semVerao)).toEqual({
      startsAt: '2026-09-26T22:30:00.000Z', endsAt: '2026-09-27T01:00:00.000Z', title: null, description: null,
    })
  })

  it('devolve campo vazio para data ausente e nada para campo vazio', () => {
    expect(paraCampoDeDataHora(null)).toBe('')
    expect(deCampoDeDataHora('')).toBeNull()
  })
})

describe('mensagemDeCompartilhamento', () => {
  it('junta título, resumo da programação e link — é o texto que chega no WhatsApp', () => {
    expect(mensagemDeCompartilhamento(base)).toBe(
      'Vigília de Oração dos Jovens — Sábado, 26 de setembro · 19h30 — https://iasdtucuruvi.org.br/eventos/vigilia-de-oracao-dos-jovens',
    )
    const segunda = { ...base.sessions[0], id: 'x', startsAt: '2026-09-27T12:00:00.000Z', endsAt: null }
    expect(mensagemDeCompartilhamento({ ...base, publicUrl: null, sessions: [base.sessions[0], segunda] })).toBe(
      'Vigília de Oração dos Jovens — 26 e 27 de setembro · 2 horários',
    )
  })

  it('sem programação e sem link publicado, manda só título e data', () => {
    expect(mensagemDeCompartilhamento({ title: base.title, startsAt: base.startsAt, publicUrl: null })).toBe(
      'Vigília de Oração dos Jovens — sábado, 26 de setembro de 2026 às 19:30',
    )
  })
})

describe('sessoesPreenchidas', () => {
  const preenchido = (patch: Partial<ReturnType<typeof novaSessaoDeFormulario>>) => ({ ...novaSessaoDeFormulario(), ...patch })

  it('ignora o bloco totalmente vazio e mantém os que têm qualquer campo', () => {
    const comInicio = preenchido({ inicio: '2026-09-26T19:30' })
    const soNome = preenchido({ title: 'Abertura' })
    const soFrase = preenchido({ description: 'Louvor.' })
    const soTermino = preenchido({ termino: '2026-09-26T22:00' })
    const vazio = novaSessaoDeFormulario()
    const emBranco = preenchido({ title: '   ', description: ' ' })
    expect(sessoesPreenchidas([vazio, comInicio, emBranco, soNome, soFrase, soTermino]))
      .toEqual([comInicio, soNome, soFrase, soTermino])
  })

  it('só blocos vazios viram programação vazia', () => {
    expect(sessoesPreenchidas([novaSessaoDeFormulario(), novaSessaoDeFormulario()])).toEqual([])
    expect(sessoesPreenchidas([])).toEqual([])
  })
})
