import { config } from '../../core/config.js'
import { withTransaction } from '../../core/db.js'
import { BadRequestError, ConflictError, NotFoundError, ValidationError } from '../../core/errors.js'
import { Password } from '../../core/security/password.js'
import { sendInvitationEmail } from '../../mail/auth-mail.js'
import { paginate, type Paginated } from '../../core/pagination.js'
import type { TokenService } from '../../core/security/token.service.js'
import type { UserRepository } from '../users/user.repository.js'
import type { RoleRepository } from '../roles/role.repository.js'
import type { InvitationRepository, PendingInvitationRow } from './invitation.repository.js'
import type { AuthService, PublicUser, SessionTokens } from '../auth/auth.service.js'

const DAY_MS = 86_400_000

export class InvitationService {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly users: UserRepository,
    private readonly roles: RoleRepository,
    private readonly tokens: TokenService,
    private readonly auth: AuthService,
  ) {}

  /** US-06 — cria (ou reemite) um convite e envia o e-mail. Retorna metadados SEM o token. */
  async invite(input: { email: string; roleKey: string; invitedBy: string | null }) {
    const existing = await this.users.findByEmail(input.email)
    if (existing) throw new ConflictError('Já existe um usuário com este e-mail.')

    const roleId = await this.roles.findRoleIdByKey(input.roleKey)
    if (!roleId) throw new ValidationError('Papel inválido.')

    await this.invitations.revokePendingForEmail(input.email) // CA-04: reemissão invalida o anterior

    const { token, hash } = this.tokens.generateOpaqueToken()
    const expiresAt = new Date(Date.now() + config.invitationTtlDays * DAY_MS)
    const invite = await this.invitations.create({
      email: input.email,
      roleId,
      tokenHash: hash,
      invitedBy: input.invitedBy,
      expiresAt,
    })

    await sendInvitationEmail(input.email, token)
    return { id: invite.id, email: invite.email, expiresAt: invite.expires_at }
  }

  async listPending(params: { page: number; limit: number }): Promise<Paginated<PendingInvitationRow>> {
    const offset = (params.page - 1) * params.limit
    const { rows, total } = await this.invitations.listPending({ limit: params.limit, offset })
    return paginate(rows, total, params)
  }

  async revoke(id: string): Promise<void> {
    const ok = await this.invitations.revoke(id)
    if (!ok) throw new NotFoundError('Convite pendente não encontrado.')
  }

  /** US-07 — aceita o convite, cria a conta ativa com a role e devolve a sessão (auto-login). */
  async acceptInvite(input: { token: string; name: string; password: string }): Promise<{ user: PublicUser } & SessionTokens> {
    // Política primeiro (422), sem consumir o convite (CA-03).
    const password = Password.create(input.password)

    const invite = await this.invitations.findByHash(this.tokens.hashToken(input.token))
    if (!invite || invite.status !== 'pending' || invite.expires_at.getTime() <= Date.now()) {
      throw new BadRequestError('Convite inválido ou expirado.')
    }

    // Corrida: o e-mail pode ter virado usuário por outra via desde o convite.
    const existing = await this.users.findByEmail(invite.email)
    if (existing) throw new ConflictError('Já existe um usuário com este e-mail.')

    const passwordHash = await password.hash()
    const user = await withTransaction(async (tx) => {
      const created = await this.users.create(
        { email: invite.email, name: input.name, passwordHash },
        tx,
      )
      await this.users.assignRole(created.id, invite.role_id, tx)
      await this.invitations.markAccepted(invite.id, tx)
      return created
    })

    const session = await this.auth.issueSession(user.id)
    return { user: { id: user.id, name: user.name, email: user.email }, ...session }
  }
}
