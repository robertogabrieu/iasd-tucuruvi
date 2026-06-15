import type { Pool } from 'pg'
import type { Queryable } from '../../core/db.js'

export interface ResetTokenRow {
  id: string
  user_id: string
  token_hash: string
  expires_at: Date
  used_at: Date | null
}

export class PasswordResetRepository {
  constructor(private readonly pool: Pool) {}

  async invalidateAllForUser(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    )
  }

  async create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [data.userId, data.tokenHash, data.expiresAt],
    )
  }

  async findByHash(hash: string): Promise<ResetTokenRow | null> {
    const r = await this.pool.query<ResetTokenRow>(
      'SELECT * FROM password_reset_tokens WHERE token_hash = $1',
      [hash],
    )
    return r.rows[0] ?? null
  }

  async markUsed(id: string, executor: Queryable = this.pool): Promise<void> {
    await executor.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [id])
  }
}
