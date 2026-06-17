/**
 * Redefine a senha de um usuário (por e-mail) e desbloqueia a conta.
 *
 * Uso:
 *   - Dev (fonte + tsx):   npm run reset:admin-password -- <email> <novaSenha>
 *                          (carregue o env, ex.: tsx --env-file=.env.dev.local \
 *                           server/scripts/reset-admin-password.ts <email> <novaSenha>)
 *   - Prod/Docker (JS):    docker compose exec app \
 *                            node dist-server/scripts/reset-admin-password.js <email> <novaSenha>
 *                          (ou `npm run reset:admin-password:prod -- <email> <novaSenha>` após o build)
 *
 * Sem argumentos, usa SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD do ambiente.
 * A nova senha precisa atender à política (8+ caracteres, 1 maiúscula, 1 número, 1 símbolo);
 * caso contrário a operação falha sem alterar nada.
 */
import { pool } from '../core/db.js'
import { UserRepository } from '../modules/users/user.repository.js'
import { Password } from '../core/security/password.js'

async function main() {
  const email = process.argv[2] ?? process.env.SEED_ADMIN_EMAIL
  const newPassword = process.argv[3] ?? process.env.SEED_ADMIN_PASSWORD

  if (!email || !newPassword) {
    console.error(
      '[reset] Informe e-mail e nova senha como argumentos, ou defina ' +
        'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD no ambiente.',
    )
    process.exit(1)
  }

  const users = new UserRepository(pool)
  const user = await users.findByEmail(email)
  if (!user) {
    console.error(`[reset] Usuário não encontrado: ${email}`)
    process.exit(1)
  }

  // Password.create valida a política e lança se não atender; argon2id no hash().
  const hash = await Password.create(newPassword).hash()
  await users.updatePasswordHash(user.id, hash)
  await users.unlock(user.id) // zera failed_login_count / locked_until

  console.log(`[reset] Senha redefinida e conta desbloqueada para ${email}.`)
  await pool.end()
}

main().catch(err => {
  console.error('[reset] falhou:', err instanceof Error ? err.message : err)
  process.exit(1)
})
