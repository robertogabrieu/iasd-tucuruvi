import type { Pool } from 'pg'
import type { Queryable } from '../../core/db.js'

export interface RefreshTokenRow {
  id: string
  user_id: string
  family_id: string
  token_hash: string
  expires_at: Date
  revoked_at: Date | null
  replaced_by: string | null
}

export class RefreshTokenRepository {
  constructor(private readonly pool: Pool) {}

  async create(data: {
    userId: string
    familyId: string
    tokenHash: string
    expiresAt: Date
  }, executor: Queryable = this.pool): Promise<RefreshTokenRow> {
    const r = await executor.query<RefreshTokenRow>(
      `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.userId, data.familyId, data.tokenHash, data.expiresAt],
    )
    return r.rows[0]
  }

  async findByHash(hash: string): Promise<RefreshTokenRow | null> {
    const r = await this.pool.query<RefreshTokenRow>(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1',
      [hash],
    )
    return r.rows[0] ?? null
  }

  async revoke(id: string, replacedBy: string | null, executor: Queryable = this.pool): Promise<void> {
    await executor.query(
      `UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $2 WHERE id = $1`,
      [id, replacedBy],
    )
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL`,
      [familyId],
    )
  }

  async revokeAllForUser(userId: string, executor: Queryable = this.pool): Promise<void> {
    await executor.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    )
  }
}
