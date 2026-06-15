import { randomUUID } from 'node:crypto'
import { config, durationToMs } from '../../core/config.js'
import { ForbiddenError, UnauthorizedError } from '../../core/errors.js'
import { Password } from '../../core/security/password.js'
import type { TokenService } from '../../core/security/token.service.js'
import type { UserRepository, UserRow } from '../users/user.repository.js'
import type { RefreshTokenRepository } from '../tokens/refresh-token.repository.js'
import type { PasswordResetRepository } from '../tokens/password-reset.repository.js'

export interface SessionTokens {
  accessToken: string
  refreshToken: string
}
export interface PublicUser {
  id: string
  name: string
  email: string
  roles?: string[]
}

const GENERIC_LOGIN_ERROR = 'Credenciais inválidas.'

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly resetTokens: PasswordResetRepository,
    private readonly tokens: TokenService,
  ) {}

  async login(input: { email: string; password: string }): Promise<{ user: PublicUser } & SessionTokens> {
    const user = await this.users.findByEmail(input.email)
    if (!user) throw new UnauthorizedError(GENERIC_LOGIN_ERROR)
    if (user.status === 'disabled') throw new ForbiddenError('Conta desabilitada.')

    // Conta bloqueada: recusa mesmo com senha correta (US-08 CA-02), mensagem genérica.
    if (user.locked_until && user.locked_until.getTime() > Date.now()) {
      throw new UnauthorizedError(GENERIC_LOGIN_ERROR)
    }

    const ok = await Password.verify(input.password, user.password_hash)
    if (!ok) {
      await this.registerFailedLogin(user)
      throw new UnauthorizedError(GENERIC_LOGIN_ERROR)
    }

    await this.users.markLoginSuccess(user.id)
    const session = await this.issueSession(user.id)
    return { user: this.toPublic(user), ...session }
  }

  async refresh(_refreshToken: string | undefined): Promise<{ user: PublicUser } & SessionTokens> {
    throw new UnauthorizedError('Não implementado.') // substituído na Task 13
  }
  async logout(_refreshToken: string | undefined): Promise<void> {
    // substituído na Task 13
  }
  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId)
    if (!user) throw new UnauthorizedError('Não autenticado.')
    return this.toPublic(user) // roles adicionados na Task 13
  }
  async forgotPassword(_email: string): Promise<void> {
    // substituído na Task 14
  }
  async resetPassword(_token: string, _password: string): Promise<void> {
    throw new UnauthorizedError('Não implementado.') // substituído na Task 14
  }

  /** Incrementa falhas e, ao atingir o limiar, aplica lockout progressivo. */
  private async registerFailedLogin(user: UserRow): Promise<void> {
    const failed = await this.users.incrementFailedLogin(user.id)
    if (failed >= config.lockoutThreshold) {
      const idx = Math.min(user.lock_cycle_count, config.lockoutBackoffMs.length - 1)
      const lockedUntil = new Date(Date.now() + config.lockoutBackoffMs[idx])
      await this.users.applyLockout(user.id, lockedUntil, user.lock_cycle_count + 1)
    }
  }

  /** Cria uma nova família de refresh token + emite access. */
  private async issueSession(userId: string, familyId = randomUUID()): Promise<SessionTokens> {
    const { token, hash } = this.tokens.generateOpaqueToken()
    await this.refreshTokens.create({
      userId,
      familyId,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + durationToMs(config.jwtRefreshTtl)),
    })
    const accessToken = await this.tokens.issueAccessToken(userId)
    return { accessToken, refreshToken: token }
  }

  private toPublic(u: UserRow): PublicUser {
    return { id: u.id, name: u.name, email: u.email }
  }
}
