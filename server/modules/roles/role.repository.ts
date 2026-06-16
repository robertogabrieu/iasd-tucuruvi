import type { Pool } from 'pg'
import { withTransaction } from '../../core/db.js'

export interface RoleRow {
  id: string
  key: string
  name: string
}

export class RoleRepository {
  constructor(private readonly pool: Pool) {}

  async ensurePermission(key: string, description: string): Promise<string> {
    const r = await this.pool.query<{ id: string }>(
      `INSERT INTO permissions (key, description) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description RETURNING id`,
      [key, description],
    )
    return r.rows[0].id
  }

  async ensureRole(key: string, name: string): Promise<string> {
    const r = await this.pool.query<{ id: string }>(
      `INSERT INTO roles (key, name) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [key, name],
    )
    return r.rows[0].id
  }

  async linkAllPermissions(roleId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT $1, id FROM permissions ON CONFLICT DO NOTHING`,
      [roleId],
    )
  }

  async findRoleIdByKey(key: string): Promise<string | null> {
    const r = await this.pool.query<{ id: string }>('SELECT id FROM roles WHERE key = $1', [key])
    return r.rows[0]?.id ?? null
  }

  async listRoles(): Promise<RoleRow[]> {
    const r = await this.pool.query<RoleRow>('SELECT id, key, name FROM roles ORDER BY name')
    return r.rows
  }

  async exists(roleId: string): Promise<boolean> {
    const r = await this.pool.query('SELECT 1 FROM roles WHERE id = $1', [roleId])
    return r.rowCount === 1
  }

  async removeUserRole(userId: string, roleId: string): Promise<void> {
    await this.pool.query('DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [userId, roleId])
  }

  async roleHasPermission(roleId: string, key: string): Promise<boolean> {
    const r = await this.pool.query<{ ok: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
         WHERE rp.role_id = $1 AND p.key = $2
       ) AS ok`,
      [roleId, key],
    )
    return r.rows[0].ok
  }

  async findById(id: string): Promise<RoleRow | null> {
    const r = await this.pool.query<RoleRow>('SELECT id, key, name FROM roles WHERE id = $1', [id])
    return r.rows[0] ?? null
  }

  async create(key: string, name: string): Promise<RoleRow> {
    const r = await this.pool.query<RoleRow>(
      'INSERT INTO roles (key, name) VALUES ($1, $2) RETURNING id, key, name',
      [key, name],
    )
    return r.rows[0]
  }

  async rename(id: string, name: string): Promise<void> {
    await this.pool.query('UPDATE roles SET name = $2 WHERE id = $1', [id, name])
  }

  async deleteRole(id: string): Promise<void> {
    await this.pool.query('DELETE FROM roles WHERE id = $1', [id])
  }

  async countUsers(roleId: string): Promise<number> {
    const r = await this.pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM user_roles WHERE role_id = $1', [roleId],
    )
    return r.rows[0].count
  }

  async listForManagement(): Promise<{ id: string; key: string; name: string; permissions: string[]; user_count: number }[]> {
    const r = await this.pool.query<{ id: string; key: string; name: string; permissions: string[]; user_count: number }>(
      `SELECT r.id, r.key, r.name,
              COALESCE(array_remove(array_agg(DISTINCT p.key), NULL), '{}') AS permissions,
              (SELECT count(*)::int FROM user_roles ur WHERE ur.role_id = r.id) AS user_count
         FROM roles r
         LEFT JOIN role_permissions rp ON rp.role_id = r.id
         LEFT JOIN permissions p       ON p.id = rp.permission_id
        GROUP BY r.id
        ORDER BY r.name`,
    )
    return r.rows
  }

  async setPermissions(roleId: string, keys: string[]): Promise<void> {
    await withTransaction(async (tx) => {
      await tx.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId])
      if (keys.length > 0) {
        await tx.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           SELECT $1, id FROM permissions WHERE key = ANY($2::text[])`,
          [roleId, keys],
        )
      }
    })
  }
}
