import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/** Envelope cifrado, gravável direto como jsonb. Texto claro nunca é persistido. */
export interface EncryptedValue {
  ciphertext: string // base64
  iv: string         // base64 (12 bytes, nonce GCM)
  authTag: string    // base64 (16 bytes)
  keyVersion: number // habilita rotação (US-15 CA-06)
}

const ALGO = 'aes-256-gcm'

/** Converte a chave (hex de 64 chars OU base64) em Buffer de 32 bytes. Falha cedo se inválida. */
export function parseKey(raw: string): Buffer {
  let key: Buffer
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex')
  } else {
    key = Buffer.from(raw, 'base64')
  }
  if (key.length !== 32) {
    throw new Error('CONFIG_ENCRYPTION_KEY inválida: precisa ter 32 bytes (hex de 64 chars ou base64).')
  }
  return key
}

/**
 * Cifragem reversível de segredos de configuração (US-15). Reutilizável por qualquer feature
 * que precise guardar um segredo recuperável em texto claro (ex.: senha SMTP).
 * É uma classe porque carrega estado (chave + versão) e tem mais de um consumidor previsto.
 */
export class CryptoService {
  constructor(private readonly key: Buffer, private readonly keyVersion = 1) {}

  encrypt(plaintext: string): EncryptedValue {
    const iv = randomBytes(12)
    const cipher = createCipheriv(ALGO, this.key, iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyVersion: this.keyVersion,
    }
  }

  decrypt(value: EncryptedValue): string {
    const decipher = createDecipheriv(ALGO, this.key, Buffer.from(value.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(value.authTag, 'base64'))
    try {
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(value.ciphertext, 'base64')),
        decipher.final(), // lança se o authTag não bate (conteúdo adulterado — US-15 CA-03)
      ])
      return plaintext.toString('utf8')
    } catch {
      // Não vaza conteúdo; o handler central traduz para 500 e loga server-side.
      throw new Error('Falha ao decifrar segredo de configuração (integridade inválida).')
    }
  }
}
