// server/core/errors.ts
export abstract class AppError extends Error {
  abstract readonly status: number
  readonly expose = true // mensagem segura para o cliente
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class BadRequestError extends AppError {
  readonly status = 400
  constructor(message: string, readonly details?: unknown) { super(message) }
}
export class UnauthorizedError extends AppError { readonly status = 401 }
export class ForbiddenError extends AppError { readonly status = 403 }
export class NotFoundError extends AppError { readonly status = 404 }
export class ConflictError extends AppError { readonly status = 409 }
export class TooManyRequestsError extends AppError { readonly status = 429 }

export class ValidationError extends AppError {
  readonly status = 422
  constructor(message: string, readonly details?: unknown) { super(message) }
}
