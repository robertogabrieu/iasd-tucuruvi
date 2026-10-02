import * as Sentry from '@sentry/node'
import type { ErrorRequestHandler } from 'express'
import { deveIrAoSentry, opcoesDoSentry } from './lib/sentry.js'

// Primeiro import do servidor, para o Sentry já estar de pé quando o resto carregar.
//
// A captura automática do Express fica desligada: quem decide o que vai ao Sentry é o
// `capturarNoSentry`, abaixo, com o mesmo critério do tratador de erro do site.
Sentry.init({
  ...opcoesDoSentry(process.env.NODE_ENV === 'production'),
  integrations: [Sentry.expressIntegration({ shouldHandleError: false })],
})

// Entra logo antes do tratador de erro do site, que é quem responde ao visitante.
export const capturarNoSentry: ErrorRequestHandler = (erro, _req, _res, next) => {
  if (deveIrAoSentry(erro)) Sentry.captureException(erro)
  next(erro)
}
