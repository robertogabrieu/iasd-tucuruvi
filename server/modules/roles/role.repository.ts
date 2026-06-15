import type { Pool } from 'pg'

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
}
