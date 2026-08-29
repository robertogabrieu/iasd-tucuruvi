// server/core/error-handler.ts
import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { AppError, BadRequestError, ValidationError } from './errors.js'

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ValidationError) {
    res.status(422).json({ error: err.message, details: err.details })
    return
  }
  if (err instanceof BadRequestError) {
    res.status(400).json({ error: err.message, details: err.details })
    return
  }
  if (err instanceof ZodError) {
    res.status(422).json({ error: 'Dados inválidos.', details: err.flatten().fieldErrors })
    return
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  console.error('[unhandled]', err)
  res.status(500).json({ error: 'Erro interno.' })
}
