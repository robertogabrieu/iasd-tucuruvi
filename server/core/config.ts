// server/core/config.ts
import path from 'path'

function req(name: string): string {
  const v = process.env[name]
  if (!v && process.env.NODE_ENV === 'production') {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`)
  }
  return v ?? ''
}

function int(name: string, fallback: number): number {
  const v = process.env[name]
  return v ? Number(v) : fallback
}

export const config = {
  databaseUrl: req('DATABASE_URL'),

  // Biblioteca de mídia (US-17)
  uploadsDir: process.env.UPLOADS_DIR ||
    (process.env.NODE_ENV === 'production' ? '/app/uploads' : path.resolve('.uploads')),
  mediaMaxBytes: int('MEDIA_MAX_BYTES', 5 * 1024 * 1024), // 5 MB

  jwtAccessSecret: req('JWT_ACCESS_SECRET') || 'dev-access-secret-trocar',
  jwtAccessTtl: process.env.JWT_ACCESS_TTL || '15m',
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL || '7d',
  // JWT_REFRESH_SECRET existe no .env mas NÃO é usado: o refresh token é opaco (hash sha256),
  // não um JWT. Ver spec §11.

  csrfSecret: req('CSRF_SECRET') || 'dev-csrf-secret-trocar',

  cookieSecure: process.env.COOKIE_SECURE === 'true',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5173',
  // URL pública absoluta do site (para publicUrl do boletim e Open Graph). Vazia em dev → URL relativa.
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? '',

  passwordResetTtlMin: int('PASSWORD_RESET_TTL_MIN', 30),
  invitationTtlDays: int('INVITE_TTL_DAYS', 7),

  // Criptografia de segredos reversíveis (US-15). 32 bytes em hex (64 chars) ou base64.
  configEncryptionKey: req('CONFIG_ENCRYPTION_KEY') ||
    '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff', // dev — trocar em prod
  configEncryptionKeyOld: process.env.CONFIG_ENCRYPTION_KEY_OLD || '', // usada só durante rotação

  // Fallback inicial da config de e-mail (US-14 CA-03): vale só enquanto não há config no banco.
  emailEnvFallback: {
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT) || 1025,
    secure: process.env.SMTP_SECURE === 'true',
    from: process.env.SMTP_FROM || 'noreply@iasdtucuruvi.com.br',
    to: process.env.SMTP_TO || 'contato@iasdtucuruvi.com.br',
    authUser: process.env.SMTP_USER || '',
    authPass: process.env.SMTP_PASS || '',
  },

  loginRateMax: int('LOGIN_RATE_MAX', 10),
  loginRateWindowMs: int('LOGIN_RATE_WINDOW_MS', 300_000),
  forgotRateMax: int('FORGOT_RATE_MAX', 3),
  forgotRateWindowMs: int('FORGOT_RATE_WINDOW_MS', 900_000),

  lockoutThreshold: int('LOCKOUT_THRESHOLD', 5),
  // Backoff progressivo do lockout por conta (ms), indexado por lock_cycle_count (cap no último).
  lockoutBackoffMs: [60_000, 300_000, 900_000, 3_600_000],

  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || '',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || '',
}

// Converte "15m" / "7d" / "30s" / "12h" para milissegundos (para Max-Age de cookie).
export function durationToMs(d: string): number {
  const m = /^(\d+)([smhd])$/.exec(d.trim())
  if (!m) throw new Error(`Duração inválida: ${d}`)
  const n = Number(m[1])
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as 's' | 'm' | 'h' | 'd']
  return n * unit
}
