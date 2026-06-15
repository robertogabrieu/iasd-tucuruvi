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
import { RoleRepository } from './modules/roles/role.repository.js'
import { PermissionRepository } from './modules/authz/permission.repository.js'
import { InvitationRepository } from './modules/invitations/invitation.repository.js'
import { makeRequirePermission } from './modules/authz/middleware/require-permission.js'
import { RoleService } from './modules/roles/role.service.js'
import { RoleController } from './modules/roles/role.controller.js'
import { makeRoleAdminRoutes } from './modules/roles/role.routes.js'
import { InvitationService } from './modules/invitations/invitation.service.js'
import { InvitationController } from './modules/invitations/invitation.controller.js'
import {
  makeInvitationAdminRoutes, makeInvitationPublicRoutes,
} from './modules/invitations/invitation.routes.js'
import { runSeed } from './seed/seed.js'
import { CryptoService, parseKey } from './core/security/crypto.service.js'
import { setEmailConfigProvider } from './lib/mail.js'
import { SettingsRepository } from './modules/settings/settings.repository.js'
import { SettingsService } from './modules/settings/settings.service.js'
import { SettingsController } from './modules/settings/settings.controller.js'
import { makeSettingsRoutes } from './modules/settings/settings.routes.js'

const tokens = new TokenService(config.jwtAccessSecret, config.jwtAccessTtl)
const userRepo = new UserRepository(pool)
const refreshRepo = new RefreshTokenRepository(pool)
const resetRepo = new PasswordResetRepository(pool)

const authService = new AuthService(userRepo, refreshRepo, resetRepo, tokens)
const authController = new AuthController(authService)
const requireAuth = makeRequireAuth(tokens)

export const authRoutes = makeAuthRoutes(authController, requireAuth)

// --- Área administrativa (RBAC + gestão de usuários) ---
const roleRepo = new RoleRepository(pool)
const permissionRepo = new PermissionRepository(pool)
const invitationRepo = new InvitationRepository(pool)

const requirePermission = makeRequirePermission(permissionRepo)

const roleService = new RoleService(roleRepo, userRepo, permissionRepo)
const roleController = new RoleController(roleService)

const invitationService = new InvitationService(invitationRepo, userRepo, roleRepo, tokens, authService)
const invitationController = new InvitationController(invitationService)

export const roleRoutes = makeRoleAdminRoutes(roleController, requireAuth, requirePermission)
export const invitationAdminRoutes = makeInvitationAdminRoutes(invitationController, requireAuth, requirePermission)
export const invitationPublicRoutes = makeInvitationPublicRoutes(invitationController)

// --- Configurações + criptografia (US-14/15) ---
const cryptoService = new CryptoService(parseKey(config.configEncryptionKey))
const settingsRepo = new SettingsRepository(pool)
const settingsService = new SettingsService(settingsRepo, cryptoService)
const settingsController = new SettingsController(settingsService)

export const settingsRoutes = makeSettingsRoutes(settingsController, requireAuth, requirePermission)

// O envio de e-mail passa a resolver a config vigente (banco→env, senha decifrada) a cada disparo.
setEmailConfigProvider(() => settingsService.getConfigForSending())

export async function bootstrap(): Promise<void> {
  await runMigrations()
  await runSeed()
}
