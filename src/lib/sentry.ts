import { breadcrumbsIntegration, type BrowserOptions } from '@sentry/react'

// Público por natureza: só serve para enviar erros a este projeto, nunca para lê-los.
const DSN =
  'https://d54dc2f701d66faef7b9f0307abfdbd6@o4512184671272960.ingest.us.sentry.io/4512184674549760'

type Evento = Parameters<NonNullable<BrowserOptions['beforeSend']>>[0]
type Migalha = Parameters<NonNullable<BrowserOptions['beforeBreadcrumb']>>[0]

// Os links de redefinir senha e de aceitar convite levam o token na consulta do endereço. O
// SDK manda o endereço inteiro, sem respeitar a coleta desligada: corta-se aqui o que vem
// depois do caminho.
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

// O console é descartado inteiro: nele aparece o que o site escreve para depuração, inclusive
// dado de pessoa.
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

// Só captura de erros. Sem medição de desempenho e sem gravação de sessão, e sem coletar dado
// de quem navega — o site atende membros da igreja (LGPD). Saem os registros de clique, que
// levam o texto do elemento clicado (pode ser nome ou e-mail), e os de console. A versão
// que gerou o erro quem marca é o build, pelo plugin do Sentry no Vite.
export function opcoesDoSentry(producao: boolean): BrowserOptions {
  return {
    dsn: DSN,
    enabled: producao,
    environment: 'production',
    initialScope: { tags: { app: 'web' } },
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    },
    integrations: (padrao) => [
      ...padrao.filter((integracao) => !['Breadcrumbs', 'Console'].includes(integracao.name)),
      breadcrumbsIntegration({ dom: false }),
    ],
    beforeSend: limparEvento,
    beforeBreadcrumb: limparMigalha,
  }
}
