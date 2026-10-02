import type { BrowserOptions } from '@sentry/react'

// Público por natureza: só serve para enviar erros a este projeto, nunca para lê-los.
const DSN =
  'https://d54dc2f701d66faef7b9f0307abfdbd6@o4512184671272960.ingest.us.sentry.io/4512184674549760'

// Só captura de erros. Sem medição de desempenho e sem gravação de sessão, e sem coletar dado
// de quem navega — o site atende membros da igreja (LGPD). A versão que gerou o erro quem
// marca é o build, pelo plugin do Sentry no Vite.
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
  }
}
