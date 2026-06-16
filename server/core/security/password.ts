// server/core/security/password.ts
import argon2 from 'argon2'
import { ValidationError } from '../errors.js'

// Política (decisão do brainstorming): mín. 8 chars + >=1 maiúscula, >=1 número, >=1 símbolo.
// Nota: NIST 800-63B prefere comprimento a composição; mantido por escolha do usuário.
const MIN_LENGTH = 8

export function validatePasswordPolicy(plain: string): void {
  const errors: string[] = []
  if (plain.length < MIN_LENGTH) errors.push(`mínimo de ${MIN_LENGTH} caracteres`)
  if (!/[A-Z]/.test(plain)) errors.push('uma letra maiúscula')
  if (!/[0-9]/.test(plain)) errors.push('um número')
  if (!/[^A-Za-z0-9]/.test(plain)) errors.push('um símbolo')
  if (errors.length) {
    throw new ValidationError(`A senha deve conter: ${errors.join(', ')}.`)
  }
}

export class Password {
  private constructor(private readonly plain: string) {}

  /** Valida a política e cria o value object (lança ValidationError 422 se inválida). */
  static create(plain: string): Password {
    validatePasswordPolicy(plain)
    return new Password(plain)
  }

  hash(): Promise<string> {
    return argon2.hash(this.plain, { type: argon2.argon2id })
  }

  static verify(plain: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, plain).catch(() => false)
  }
}
