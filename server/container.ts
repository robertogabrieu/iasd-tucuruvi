import { pool, runMigrations } from './core/db.js'
import { config } from './core/config.js'
import { TokenService } from './core/security/token.service.js'
import { UserRepository } from './modules/users/user.repository.js'
import { RefreshTokenRepository } from './modules/tokens/refresh-token.repository.js'
import { PasswordResetRepository } from './modules/tokens/password-reset.repository.js'
import { AuthService } from './modules/auth/auth.service.js'
import { AuthController } from './modules/auth/auth.controller.js'
import { makeAuthRoutes } from './modules/auth/auth.routes.js'
import { makeRequireAuth } from './modules/auth/middleware/require-auth.js'
import { runSeed } from './seed/seed.js'

const tokens = new TokenService(config.jwtAccessSecret, config.jwtAccessTtl)
const userRepo = new UserRepository(pool)
const refreshRepo = new RefreshTokenRepository(pool)
const resetRepo = new PasswordResetRepository(pool)

const authService = new AuthService(userRepo, refreshRepo, resetRepo, tokens)
const authController = new AuthController(authService)
const requireAuth = makeRequireAuth(tokens)

export const authRoutes = makeAuthRoutes(authController, requireAuth)

export async function bootstrap(): Promise<void> {
  await runMigrations()
  await runSeed()
}
