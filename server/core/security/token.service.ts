// server/core/security/token.service.ts
import { SignJWT, jwtVerify } from 'jose'
import { randomBytes, createHash } from 'node:crypto'

export class TokenService {
  private readonly accessKey: Uint8Array

  constructor(
    accessSecret: string,
    private readonly accessTtl: string, // ex.: "15m"
  ) {
    this.accessKey = new TextEncoder().encode(accessSecret)
  }

  async issueAccessToken(userId: string): Promise<string> {
    return new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(this.accessTtl)
      .sign(this.accessKey)
  }

  /** Retorna o userId (sub) ou lança se inválido/expirado. */
  async verifyAccessToken(token: string): Promise<string> {
    const { payload } = await jwtVerify(token, this.accessKey)
    if (!payload.sub) throw new Error('sub ausente')
    return payload.sub
  }

  /** Gera um refresh token opaco e seu hash (só o hash vai pro banco). */
  generateOpaqueToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url')
    return { token, hash: this.hashToken(token) }
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }
}
