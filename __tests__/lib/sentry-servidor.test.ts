import { ZodError } from 'zod'
import { deveIrAoSentry, opcoesDoSentry } from '../../server/lib/sentry'
import { ForbiddenError, NotFoundError, ValidationError } from '../../server/core/errors'

describe('opcoesDoSentry do servidor', () => {
  it('não manda nada fora de produção', () => {
    expect(opcoesDoSentry(false).enabled).toBe(false)
  })

  it('liga em produção, etiquetado como o servidor, no mesmo projeto do site', () => {
    const opcoes = opcoesDoSentry(true)
    expect(opcoes.enabled).toBe(true)
    expect(opcoes.environment).toBe('production')
    expect(opcoes.initialScope).toEqual({ tags: { app: 'api' } })
    expect(opcoes.dsn).toMatch(/^https:\/\/.+@.+\.ingest\.us\.sentry\.io\/\d+$/)
  })

  it('não coleta dado pessoal nem mede desempenho', () => {
    const opcoes = opcoesDoSentry(true)
    expect(opcoes.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
      databaseQueryData: false,
    })
    expect(opcoes.tracesSampleRate ?? 0).toBe(0)
  })

  it('marca os erros com a versão da imagem, quando ela existe', () => {
    expect(opcoesDoSentry(true, 'abc123').release).toBe('abc123')
    expect(opcoesDoSentry(true, '').release).toBeUndefined()
    expect(opcoesDoSentry(true).release).toBeUndefined()
  })

  it('descarta o que foi escrito no console, que traz e-mail do administrador', () => {
    const migalha = opcoesDoSentry(true).beforeBreadcrumb as (m: object) => unknown
    expect(migalha({ category: 'console', message: 'admin@igreja.org' })).toBeNull()
  })

  it('tira a consulta do endereço das chamadas que o servidor faz, que levam chave de API', () => {
    const migalha = opcoesDoSentry(true).beforeBreadcrumb as (m: object) => any
    expect(migalha({ category: 'http', data: { url: 'https://www.googleapis.com/youtube/v3/x?key=chave' } }).data)
      .toEqual({ url: 'https://www.googleapis.com/youtube/v3/x' })
  })
})

describe('deveIrAoSentry', () => {
  it('manda o erro sem status, que vira 500 para o visitante', () => {
    expect(deveIrAoSentry(new Error('banco caiu'))).toBe(true)
  })

  it('manda o que o tratador responde com 500, mesmo que o erro traga outro status', () => {
    expect(deveIrAoSentry(Object.assign(new SyntaxError('json quebrado'), { status: 400 }))).toBe(true)
    expect(deveIrAoSentry(Object.assign(new Error('corpo grande demais'), { status: 413 }))).toBe(true)
  })

  it('não manda o que o tratador responde como erro de quem pediu (4xx)', () => {
    expect(deveIrAoSentry(new NotFoundError('não achou'))).toBe(false)
    expect(deveIrAoSentry(new ForbiddenError('sem permissão'))).toBe(false)
    expect(deveIrAoSentry(new ValidationError('inválido', {}))).toBe(false)
  })

  it('não manda a validação do zod, que o site responde como 422', () => {
    expect(deveIrAoSentry(new ZodError([]))).toBe(false)
  })
})
