import type { Pool } from 'pg'
import type { Queryable } from '../../core/db.js'

export interface InvitationRow {
  id: string
  email: string
  role_id: string
  token_hash: string
  invited_by: string | null
  status: 'pending' | 'accepted' | 'revoked'
  expires_at: Date
  accepted_at: Date | null
}

export class InvitationRepository {
  constructor(private readonly pool: Pool) {}

  async create(data: {
    email: string
    roleId: string
    tokenHash: string
    invitedBy: string | null
    expiresAt: Date
  }): Promise<InvitationRow> {
    const r = await this.pool.query<InvitationRow>(
      `INSERT INTO invitations (email, role_id, token_hash, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.email, data.roleId, data.tokenHash, data.invitedBy, data.expiresAt],
    )
    return r.rows[0]
  }

  async findByHash(hash: string): Promise<InvitationRow | null> {
    const r = await this.pool.query<InvitationRow>(
      'SELECT * FROM invitations WHERE token_hash = $1',
      [hash],
    )
    return r.rows[0] ?? null
  }

  async revokePendingForEmail(email: string, executor: Queryable = this.pool): Promise<void> {
    await executor.query(
      `UPDATE invitations SET status = 'revoked' WHERE email = $1 AND status = 'pending'`,
      [email],
    )
  }

  async markAccepted(id: string, executor: Queryable = this.pool): Promise<void> {
    await executor.query(
      `UPDATE invitations SET status = 'accepted', accepted_at = now() WHERE id = $1`,
      [id],
    )
  }
}
