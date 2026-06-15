import { ConflictError, NotFoundError } from '../../core/errors.js'
import type { RoleRepository, RoleRow } from './role.repository.js'
import type { UserRepository } from '../users/user.repository.js'
import type { PermissionRepository } from '../authz/permission.repository.js'

// Permissão que define um "administrador" para o guard do último admin (US-11 CA-04).
const ADMIN_PERMISSION = 'roles:assign'

export class RoleService {
  constructor(
    private readonly roles: RoleRepository,
    private readonly users: UserRepository,
    private readonly permissions: PermissionRepository,
  ) {}

  listRoles(): Promise<RoleRow[]> {
    return this.roles.listRoles()
  }

  async assignRole(userId: string, roleId: string): Promise<void> {
    const user = await this.users.findById(userId)
    if (!user) throw new NotFoundError('Usuário não encontrado.')
    if (!(await this.roles.exists(roleId))) throw new NotFoundError('Papel não encontrado.')
    await this.users.assignRole(userId, roleId) // idempotente (ON CONFLICT DO NOTHING)
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    const user = await this.users.findById(userId)
    if (!user) throw new NotFoundError('Usuário não encontrado.')

    // Guard "último admin": só se a role removida concede a permissão administrativa
    // e o usuário é ativo. Bloqueia se a remoção zeraria os admins ativos.
    if (user.status === 'active' && (await this.roles.roleHasPermission(roleId, ADMIN_PERMISSION))) {
      const keepsViaOther = await this.permissions.userHasPermissionViaOtherRole(
        userId, ADMIN_PERMISSION, roleId,
      )
      if (!keepsViaOther) {
        const others = await this.permissions.countActiveUsersWithPermissionExcept(ADMIN_PERMISSION, userId)
        if (others === 0) {
          throw new ConflictError('Operação bloqueada: o sistema ficaria sem administrador.')
        }
      }
    }

    await this.roles.removeUserRole(userId, roleId)
  }
}
