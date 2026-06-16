/**
 * Concede TODAS as permissões ao papel `admin`.
 *
 * Uso:
 *   - Dev (fonte + tsx):   npm run grant:admin-permissions          (carregue o env, ex.:
 *                          tsx --env-file=.env.dev.local server/scripts/grant-admin-permissions.ts)
 *   - Prod/pipeline (JS):  npm run grant:admin-permissions:prod     (= node dist-server/scripts/...,
 *                          após `npm run build`; lê DATABASE_URL do ambiente).
 *
 * Garante que cada permissão do catálogo (server/seed/permissions.catalog.ts) exista
 * e vincula ao papel `admin` todas as permissões presentes na tabela `permissions`
 * (inclusive as inseridas direto no banco). Idempotente — pode rodar quantas vezes quiser.
 *
 * Observação: o seed (runSeed) já faz isso a cada boot do servidor; este comando serve
 * para reaplicar sob demanda, sem reiniciar (ex.: após adicionar uma permissão nova).
 */
import { pool } from '../core/db.js'
import { RoleRepository } from '../modules/roles/role.repository.js'
import { PERMISSIONS } from '../seed/permissions.catalog.js'

async function main() {
  const roles = new RoleRepository(pool)

  for (const p of PERMISSIONS) await roles.ensurePermission(p.key, p.description)
  const adminRoleId = await roles.ensureRole('admin', 'Administrador')
  await roles.linkAllPermissions(adminRoleId)

  const { rows } = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM role_permissions WHERE role_id = $1`,
    [adminRoleId],
  )
  console.log(`[grant] papel admin agora com ${rows[0].count} permissão(ões) vinculada(s).`)
  await pool.end()
}

main().catch(err => {
  console.error('[grant] falhou:', err)
  process.exit(1)
})
