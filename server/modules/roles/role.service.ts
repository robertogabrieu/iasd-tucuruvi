import { ConflictError, NotFoundError, ValidationError } from '../../core/errors.js'
import { slugify } from './role.utils.js'
import type { RoleRepository, RoleRow } from './role.repository.js'
import type { UserRepository } from '../users/user.repository.js'
import type { PermissionRepository } from '../authz/permission.repository.js'

// Permissão que define um "administrador" para o guard do último admin (US-11 CA-04).
const ADMIN_PERMISSION = 'roles:assign'
const PROTECTED_ROLE_KEY = 'admin'

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

  listManaged(): Promise<{ id: string; key: string; name: string; permissions: string[]; userCount: number; protected: boolean }[]> {
    return this.roles.listForManagement().then(rows =>
      rows.map(r => ({
        id: r.id, key: r.key, name: r.name, permissions: r.permissions,
        userCount: r.user_count, protected: r.key === PROTECTED_ROLE_KEY,
      })),
    )
  }

  listPermissionCatalog(): Promise<{ key: string; description: string }[]> {
    return this.permissions.listCatalog()
  }

  async createRole(name: string): Promise<{ id: string; key: string; name: string }> {
    let key = slugify(name)
    if (await this.roles.findRoleIdByKey(key)) {
      let n = 2
      while (await this.roles.findRoleIdByKey(`${key}-${n}`)) n++
      key = `${key}-${n}`
    }
    return this.roles.create(key, name)
  }

  async renameRole(id: string, name: string): Promise<void> {
    await this.ensureEditable(id)
    await this.roles.rename(id, name)
  }

  async deleteRole(id: string): Promise<void> {
    await this.ensureEditable(id)
    await this.roles.deleteRole(id)
  }

  async setPermissions(id: string, keys: string[]): Promise<void> {
    await this.ensureEditable(id)
    const catalog = new Set((await this.permissions.listCatalog()).map(p => p.key))
    const invalid = keys.filter(k => !catalog.has(k))
    if (invalid.length > 0) throw new ValidationError(`Permissão(ões) inválida(s): ${invalid.join(', ')}`)
    await this.roles.setPermissions(id, keys)
  }

  private async ensureEditable(id: string): Promise<void> {
    const role = await this.roles.findById(id)
    if (!role) throw new NotFoundError('Papel não encontrado.')
    if (role.key === PROTECTED_ROLE_KEY) throw new ConflictError('Papel protegido: não pode ser alterado ou excluído.')
  }
}
