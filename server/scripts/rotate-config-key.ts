/**
 * Rotação da CONFIG_ENCRYPTION_KEY (US-15 CA-06).
 * Uso: defina CONFIG_ENCRYPTION_KEY_OLD (chave atual) e CONFIG_ENCRYPTION_KEY (nova), então:
 *   npm run rotate:config-key
 * Decifra cada segredo com a chave antiga e recifra com a nova, em transação.
 */
import { pool, withTransaction } from '../core/db.js'
import { config } from '../core/config.js'
import { CryptoService, parseKey, type EncryptedValue } from '../core/security/crypto.service.js'

function isEnvelope(v: unknown): v is EncryptedValue {
  return !!v && typeof v === 'object' &&
    'ciphertext' in v && 'iv' in v && 'authTag' in v && 'keyVersion' in v
}

async function main() {
  if (!config.configEncryptionKeyOld) {
    throw new Error('Defina CONFIG_ENCRYPTION_KEY_OLD (chave antiga) para rotacionar.')
  }
  const oldCrypto = new CryptoService(parseKey(config.configEncryptionKeyOld))
  const newKey = parseKey(config.configEncryptionKey)

  const { rows } = await pool.query<{ key: string; value: unknown }>('SELECT key, value FROM settings')
  const targets = rows.filter(r => isEnvelope(r.value))
  console.log(`[rotate] ${targets.length} segredo(s) cifrado(s) encontrado(s).`)

  await withTransaction(async (tx) => {
    for (const row of targets) {
      const env = row.value as EncryptedValue
      const plaintext = oldCrypto.decrypt(env)
      // keyVersion é informativo (decrypt não o usa para escolher chave). Derivamos do registro
      // atual + 1 para que o campo permaneça verdadeiro em rotações sucessivas (v1→v2→v3…).
      const nextVersion = (env.keyVersion ?? 1) + 1
      const recifrado = new CryptoService(newKey, nextVersion).encrypt(plaintext)
      await tx.query('UPDATE settings SET value = $2::jsonb, updated_at = now() WHERE key = $1',
        [row.key, JSON.stringify(recifrado)])
      console.log(`[rotate] recifrado: ${row.key}`)
    }
  })
  console.log('[rotate] concluído. Atualize CONFIG_ENCRYPTION_KEY no .env e remova CONFIG_ENCRYPTION_KEY_OLD.')
  await pool.end()
}

main().catch((e) => { console.error('[rotate] falhou:', e); process.exit(1) })
