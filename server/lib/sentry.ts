import type { NodeOptions } from '@sentry/node'
import { ZodError } from 'zod'
import { AppError } from '../core/errors.js'

// Mesmo projeto do site, separado dele pela etiqueta `app`. Público por natureza: só serve
// para enviar erros, nunca para lê-los.
const DSN =
  'https://d54dc2f701d66faef7b9f0307abfdbd6@o4512184671272960.ingest.us.sentry.io/4512184674549760'

type Evento = Parameters<NonNullable<NodeOptions['beforeSend']>>[0]
type Migalha = Parameters<NonNullable<NodeOptions['beforeBreadcrumb']>>[0]

// Endereço sem consulta: nela viajam o token dos links de senha e convite e as chaves das
// APIs que o servidor chama (YouTube, Flickr).
function semConsulta(endereco: unknown): unknown {
  return typeof endereco === 'string' ? endereco.split(/[?#]/)[0] : endereco
}

function limparEvento(evento: Evento): Evento {
  const pedido = evento.request
  if (!pedido) return evento
  pedido.url = semConsulta(pedido.url) as string | undefined
  delete pedido.query_string
  if (pedido.headers) {
    for (const nome of Object.keys(pedido.headers)) {
      if (nome.toLowerCase() === 'referer') pedido.headers[nome] = semConsulta(pedido.headers[nome]) as string
    }
  }
  return evento
}

// O console é descartado inteiro: o seed escreve nele o e-mail do administrador.
function limparMigalha(migalha: Migalha): Migalha | null {
  if (migalha.category === 'console') return null
  const dados = migalha.data
  if (dados) {
    for (const campo of ['url', 'from', 'to']) {
      if (campo in dados) dados[campo] = semConsulta(dados[campo])
    }
  }
  return migalha
}

// Só captura de erros, sem medição de desempenho, e sem coletar dado de quem usa o site — ele
// atende membros da igreja (LGPD). A versão é o commit da imagem, gravado no build.
export function opcoesDoSentry(producao: boolean, versao?: string): NodeOptions {
  return {
    dsn: DSN,
    enabled: producao,
    environment: 'production',
    release: versao || undefined,
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
    beforeSend: limparEvento,
    beforeBreadcrumb: limparMigalha,
  }
}

// Segue o tratador de erro do site: vai ao Sentry o que ele responde com 500. Os erros do
// próprio site trazem o status deles e a validação vira 422; qualquer outro erro — JSON
// malformado e corpo grande demais inclusive, mesmo trazendo 400 ou 413 — sai como 500.
export function deveIrAoSentry(erro: unknown): boolean {
  if (erro instanceof ZodError) return false
  if (erro instanceof AppError) return erro.status >= 500
  return true
}
