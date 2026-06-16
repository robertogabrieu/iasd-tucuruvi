import { ConflictError, NotFoundError } from '../../core/errors.js'
import { paginate, type Paginated } from '../../core/pagination.js'
import type { UserRepository, AdminUserListRow, AdminUserDetailRow } from './user.repository.js'
import type { PermissionRepository } from '../authz/permission.repository.js'
import type { RefreshTokenRepository } from '../tokens/refresh-token.repository.js'
import type { AuthService } from '../auth/auth.service.js'

// Permissão que caracteriza um administrador (mesmo critério do guard de US-11).
const ADMIN_PERMISSION = 'roles:assign'

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly permissions: PermissionRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly auth: AuthService,
  ) {}

  async list(params: { page: number; limit: number }): Promise<Paginated<AdminUserListRow>> {
    const offset = (params.page - 1) * params.limit
    const { rows, total } = await this.users.listWithRoles({ limit: params.limit, offset })
    return paginate(rows, total, params)
  }

  async get(id: string): Promise<AdminUserDetailRow> {
    const user = await this.users.findByIdWithRoles(id)
    if (!user) throw new NotFoundError('Usuário não encontrado.')
    return user
  }

  async update(id: string, data: { name?: string; email?: string }): Promise<void> {
    const user = await this.users.findById(id)
    if (!user) throw new NotFoundError('Usuário não encontrado.')
    if (data.email) {
      const other = await this.users.findByEmail(data.email)
      if (other && other.id !== id) throw new ConflictError('Já existe um usuário com este e-mail.')
    }
    await this.users.updateProfile(id, data)
  }

  async setStatus(id: string, status: 'active' | 'disabled'): Promise<void> {
    const user = await this.users.findById(id)
    if (!user) throw new NotFoundError('Usuário não encontrado.')

    if (status === 'disabled') {
      const isAdmin = await this.permissions.userHasPermission(id, ADMIN_PERMISSION)
      if (isAdmin) {
        const others = await this.permissions.countActiveUsersWithPermissionExcept(ADMIN_PERMISSION, id)
        if (others === 0) {
          throw new ConflictError('Operação bloqueada: o sistema ficaria sem administrador.')
        }
      }
    }

    await this.users.setStatus(id, status)
    if (status === 'disabled') await this.refreshTokens.revokeAllForUser(id)
  }

  async unlock(id: string): Promise<void> {
    const user = await this.users.findById(id)
    if (!user) throw new NotFoundError('Usuário não encontrado.')
    await this.users.unlock(id)
  }

  /** Dispara o e-mail de redefinição reusando o fluxo de US-04 (resposta sempre genérica). */
  async triggerPasswordReset(id: string): Promise<void> {
    const user = await this.users.findById(id)
    if (!user) throw new NotFoundError('Usuário não encontrado.')
    await this.auth.forgotPassword(user.email)
  }
}
