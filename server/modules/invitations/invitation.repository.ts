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

export interface PendingInvitationRow {
  id: string
  email: string
  role_name: string
  invited_by_name: string | null
  expires_at: Date
  created_at: Date
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

  async listPending(
    { limit, offset }: { limit: number; offset: number },
  ): Promise<{ rows: PendingInvitationRow[]; total: number }> {
    const rows = await this.pool.query<PendingInvitationRow>(
      `SELECT i.id, i.email, r.name AS role_name, u.name AS invited_by_name,
              i.expires_at, i.created_at
         FROM invitations i
         JOIN roles r      ON r.id = i.role_id
         LEFT JOIN users u ON u.id = i.invited_by
        WHERE i.status = 'pending'
        ORDER BY i.created_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    )
    const count = await this.pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM invitations WHERE status = 'pending'`,
    )
    return { rows: rows.rows, total: count.rows[0].count }
  }

  /** Revoga um convite pendente. Retorna false se não havia pendente com esse id. */
  async revoke(id: string): Promise<boolean> {
    const r = await this.pool.query(
      `UPDATE invitations SET status = 'revoked' WHERE id = $1 AND status = 'pending'`,
      [id],
    )
    return r.rowCount === 1
  }
}
