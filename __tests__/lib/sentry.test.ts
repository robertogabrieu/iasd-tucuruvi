import * as Sentry from '@sentry/react'
import { opcoesDoSentry } from '../../src/lib/sentry'

jest.mock('@sentry/react', () => ({
  breadcrumbsIntegration: jest.fn((opcoes: object) => ({ name: 'Breadcrumbs', opcoes })),
}))

describe('opcoesDoSentry', () => {
  it('não manda nada fora de produção, para não gastar a cota com dev e teste', () => {
    expect(opcoesDoSentry(false).enabled).toBe(false)
  })

  it('liga em produção, com o ambiente marcado como production', () => {
    const opcoes = opcoesDoSentry(true)
    expect(opcoes.enabled).toBe(true)
    expect(opcoes.environment).toBe('production')
    expect(opcoes.dsn).toMatch(/^https:\/\/.+@.+\.ingest\.us\.sentry\.io\/\d+$/)
  })

  it('etiqueta os erros como vindos do site, que divide o projeto com o servidor', () => {
    expect(opcoesDoSentry(true).initialScope).toEqual({ tags: { app: 'web' } })
  })

  it('não envia dado pessoal nem mede desempenho', () => {
    const opcoes = opcoesDoSentry(true)
    expect(opcoes.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    })
    expect(opcoes.tracesSampleRate ?? 0).toBe(0)
  })

  it('não registra clique nem console: o texto do elemento clicado pode ser nome ou e-mail', () => {
    const integracoes = opcoesDoSentry(true).integrations as (padrao: object[]) => object[]
    const padrao = [{ name: 'GlobalHandlers' }, { name: 'Breadcrumbs' }, { name: 'Console' }]
    expect(integracoes(padrao)).toEqual([{ name: 'GlobalHandlers' }, { name: 'Breadcrumbs', opcoes: { dom: false } }])
    expect(Sentry.breadcrumbsIntegration).toHaveBeenCalledWith({ dom: false })
  })
})

describe('opcoesDoSentry — endereço sem token', () => {
  const { beforeSend, beforeBreadcrumb } = opcoesDoSentry(true)
  const enviar = (evento: object) => (beforeSend as (e: object, h: object) => any)(evento, {})
  const migalha = (m: object) => (beforeBreadcrumb as (m: object) => any)(m)

  it('tira consulta e âncora do endereço da página e do Referer', () => {
    const evento = enviar({
      request: {
        url: 'https://site.org/redefinir-senha?token=segredo#x',
        query_string: 'token=segredo',
        headers: { Referer: 'https://site.org/aceitar-convite?token=outro', 'User-Agent': 'ua' },
      },
    })
    expect(evento.request.url).toBe('https://site.org/redefinir-senha')
    expect(evento.request.query_string).toBeUndefined()
    expect(evento.request.headers).toEqual({ Referer: 'https://site.org/aceitar-convite', 'User-Agent': 'ua' })
  })

  it('aceita evento sem request', () => {
    expect(enviar({ message: 'x' })).toEqual({ message: 'x' })
  })

  it('tira consulta e âncora da navegação', () => {
    const m = migalha({ category: 'navigation', data: { from: '/aceitar-convite?token=a', to: '/painel#topo' } })
    expect(m.data).toEqual({ from: '/aceitar-convite', to: '/painel' })
  })

  it('tira consulta e âncora de fetch e xhr', () => {
    expect(migalha({ category: 'fetch', data: { url: '/api/auth/reset?token=a', method: 'POST' } }).data)
      .toEqual({ url: '/api/auth/reset', method: 'POST' })
    expect(migalha({ category: 'xhr', data: { url: 'https://site.org/api/x?k=1' } }).data)
      .toEqual({ url: 'https://site.org/api/x' })
  })

  it('descarta o que foi escrito no console', () => {
    expect(migalha({ category: 'console', message: 'admin@igreja.org' })).toBeNull()
  })

  it('mantém o resto como veio', () => {
    const outra = { category: 'sentry.event', message: 'erro anterior' }
    expect(migalha(outra)).toEqual(outra)
  })
})
