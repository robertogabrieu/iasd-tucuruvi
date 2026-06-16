import type { Pool } from 'pg'
import type { Queryable } from '../../core/db.js'

/** Único ponto de SQL da tabela settings. Valores são jsonb arbitrários. */
export class SettingsRepository {
  constructor(private readonly pool: Pool) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const r = await this.pool.query<{ value: T }>('SELECT value FROM settings WHERE key = $1', [key])
    return r.rows[0]?.value ?? null
  }

  async upsert(key: string, value: unknown, updatedBy: string | null = null, executor: Queryable = this.pool): Promise<void> {
    await executor.query(
      `INSERT INTO settings (key, value, updated_by, updated_at)
       VALUES ($1, $2::jsonb, $3, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [key, JSON.stringify(value), updatedBy],
    )
  }
}
