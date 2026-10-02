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
})

describe('deveIrAoSentry', () => {
  it('manda o erro sem status, que vira 500 para o visitante', () => {
    expect(deveIrAoSentry(new Error('banco caiu'))).toBe(true)
  })

  it('manda erro com status 5xx', () => {
    expect(deveIrAoSentry(Object.assign(new Error('x'), { status: 503 }))).toBe(true)
  })

  it('não manda o que o site responde como erro de quem pediu (4xx)', () => {
    expect(deveIrAoSentry(new NotFoundError('não achou'))).toBe(false)
    expect(deveIrAoSentry(new ForbiddenError('sem permissão'))).toBe(false)
    expect(deveIrAoSentry(new ValidationError('inválido', {}))).toBe(false)
    expect(deveIrAoSentry(Object.assign(new SyntaxError('json quebrado'), { status: 400 }))).toBe(false)
  })

  it('não manda a validação do zod, que o site responde como 422', () => {
    expect(deveIrAoSentry(new ZodError([]))).toBe(false)
  })
})
