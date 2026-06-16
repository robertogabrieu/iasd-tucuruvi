import { pool } from '../core/db.js'
import { config } from '../core/config.js'
import { RoleRepository } from '../modules/roles/role.repository.js'
import { UserRepository } from '../modules/users/user.repository.js'
import { Password } from '../core/security/password.js'
import { PERMISSIONS } from './permissions.catalog.js'

export async function runSeed(): Promise<void> {
  const roles = new RoleRepository(pool)
  const users = new UserRepository(pool)

  // 1) Permissões + role admin com todas as permissões (idempotente).
  for (const p of PERMISSIONS) await roles.ensurePermission(p.key, p.description)
  const adminRoleId = await roles.ensureRole('admin', 'Administrador')
  await roles.linkAllPermissions(adminRoleId)

  // 2) Primeiro usuário (só se ainda não há nenhum).
  const total = await users.countUsers()
  if (total > 0) {
    console.log('[seed] usuários já existem — pulando criação do admin.')
    return
  }
  if (!config.seedAdminEmail || !config.seedAdminPassword) {
    console.warn('[seed] SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD ausentes e nenhum usuário existe. ' +
      'Nenhum admin criado — defina as variáveis e reinicie para criar o primeiro acesso.')
    return
  }
  let passwordHash: string
  try {
    passwordHash = await Password.create(config.seedAdminPassword).hash()
  } catch {
    console.error('[seed] SEED_ADMIN_PASSWORD não atende à política de senha. Admin não criado.')
    return
  }
  const admin = await users.create({
    email: config.seedAdminEmail,
    name: 'Administrador',
    passwordHash,
  })
  await users.assignRole(admin.id, adminRoleId)
  console.log(`[seed] admin criado: ${admin.email}`)
}
