import { opcoesDoSentry } from '../../src/lib/sentry'

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
    expect(opcoes.integrations).toBeUndefined()
  })
})
