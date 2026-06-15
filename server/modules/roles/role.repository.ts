import type { Pool } from 'pg'

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
}
