import type { NodeOptions } from '@sentry/node'
import { ZodError } from 'zod'

// Mesmo projeto do site, separado dele pela etiqueta `app`. Público por natureza: só serve
// para enviar erros, nunca para lê-los.
const DSN =
  'https://d54dc2f701d66faef7b9f0307abfdbd6@o4512184671272960.ingest.us.sentry.io/4512184674549760'

// Só captura de erros, sem medição de desempenho, e sem coletar dado de quem usa o site — ele
// atende membros da igreja (LGPD).
export function opcoesDoSentry(producao: boolean): NodeOptions {
  return {
    dsn: DSN,
    enabled: producao,
    environment: 'production',
    initialScope: { tags: { app: 'api' } },
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
      databaseQueryData: false,
    },
  }
}

// Vai ao Sentry só o que o visitante recebe como falha do site (500 em diante). O resto é
// pedido errado de quem chamou — validação, sem permissão, não encontrado — e gastaria a cota.
export function deveIrAoSentry(erro: unknown): boolean {
  if (erro instanceof ZodError) return false
  const { status, statusCode } = (erro ?? {}) as { status?: unknown; statusCode?: unknown }
  const codigo = Number(status ?? statusCode)
  return Number.isNaN(codigo) || codigo >= 500
}
