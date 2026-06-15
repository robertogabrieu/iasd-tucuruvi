import type { Pool } from 'pg'

/**
 * Resolve permissões pela cadeia users → user_roles → roles → role_permissions → permissions,
 * sempre filtrando usuários ativos. Permissão concedida por QUALQUER role autoriza (união — US-10 CA-04).
 */
export class PermissionRepository {
  constructor(private readonly pool: Pool) {}

  async userHasPermission(userId: string, key: string): Promise<boolean> {
    const r = await this.pool.query<{ ok: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM users u
         JOIN user_roles ur      ON ur.user_id = u.id
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p       ON p.id = rp.permission_id
         WHERE u.id = $1 AND u.status = 'active' AND p.key = $2
       ) AS ok`,
      [userId, key],
    )
    return r.rows[0].ok
  }

  /** Usuário mantém a permissão por alguma role DIFERENTE de exceptRoleId? (guard "último admin") */
  async userHasPermissionViaOtherRole(userId: string, key: string, exceptRoleId: string): Promise<boolean> {
    const r = await this.pool.query<{ ok: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM users u
         JOIN user_roles ur      ON ur.user_id = u.id
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p       ON p.id = rp.permission_id
         WHERE u.id = $1 AND u.status = 'active' AND p.key = $2 AND ur.role_id <> $3
       ) AS ok`,
      [userId, key, exceptRoleId],
    )
    return r.rows[0].ok
  }

  /** Quantos OUTROS usuários ativos detêm a permissão (exclui exceptUserId). */
  async countActiveUsersWithPermissionExcept(key: string, exceptUserId: string): Promise<number> {
    const r = await this.pool.query<{ count: number }>(
      `SELECT count(DISTINCT u.id)::int AS count
         FROM users u
         JOIN user_roles ur      ON ur.user_id = u.id
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p       ON p.id = rp.permission_id
         WHERE u.status = 'active' AND p.key = $1 AND u.id <> $2`,
      [key, exceptUserId],
    )
    return r.rows[0].count
  }
}
