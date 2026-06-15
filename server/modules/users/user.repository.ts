import type { Pool } from 'pg'

export interface UserRow {
  id: string
  email: string
  password_hash: string
  name: string
  status: 'active' | 'disabled'
  failed_login_count: number
  locked_until: Date | null
  lock_cycle_count: number
  last_login_at: Date | null
}

export class UserRepository {
  constructor(private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<UserRow | null> {
    const r = await this.pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [email])
    return r.rows[0] ?? null
  }

  async findById(id: string): Promise<UserRow | null> {
    const r = await this.pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [id])
    return r.rows[0] ?? null
  }

  async countUsers(): Promise<number> {
    const r = await this.pool.query<{ count: string }>('SELECT count(*)::int AS count FROM users')
    return Number(r.rows[0].count)
  }

  async create(data: { email: string; name: string; passwordHash: string }): Promise<UserRow> {
    const r = await this.pool.query<UserRow>(
      `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING *`,
      [data.email, data.name, data.passwordHash],
    )
    return r.rows[0]
  }

  async markLoginSuccess(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE users SET failed_login_count = 0, locked_until = NULL, lock_cycle_count = 0,
       last_login_at = now(), updated_at = now() WHERE id = $1`,
      [id],
    )
  }

  async incrementFailedLogin(id: string): Promise<number> {
    const r = await this.pool.query<{ failed_login_count: number }>(
      `UPDATE users SET failed_login_count = failed_login_count + 1, updated_at = now()
       WHERE id = $1 RETURNING failed_login_count`,
      [id],
    )
    return r.rows[0].failed_login_count
  }

  async applyLockout(id: string, lockedUntil: Date, nextCycle: number): Promise<void> {
    await this.pool.query(
      `UPDATE users SET locked_until = $2, lock_cycle_count = $3, failed_login_count = 0,
       updated_at = now() WHERE id = $1`,
      [id, lockedUntil, nextCycle],
    )
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.pool.query(
      'UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1',
      [id, passwordHash],
    )
  }

  async getRoleKeys(userId: string): Promise<string[]> {
    const r = await this.pool.query<{ key: string }>(
      `SELECT r.key FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1`,
      [userId],
    )
    return r.rows.map(x => x.key)
  }

  async assignRole(userId: string, roleId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, roleId],
    )
  }
}
