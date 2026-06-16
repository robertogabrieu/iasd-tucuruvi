import type { Request, Response } from 'express'
import { rateLimit } from '../../lib/rate-limit.js'
import { config } from '../../core/config.js'
import { TooManyRequestsError } from '../../core/errors.js'
import { issueCsrfToken } from '../../core/security/csrf.js'
import { loginDto, forgotPasswordDto, resetPasswordDto } from './dto/auth.dto.js'
import {
  setAccessCookie, setRefreshCookie, setCsrfCookie, clearSessionCookies,
} from './auth.cookies.js'
import type { AuthService } from './auth.service.js'

function clientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown'
}

export class AuthController {
  private readonly loginLimiter = rateLimit({
    maxRequests: config.loginRateMax,
    windowMs: config.loginRateWindowMs,
  })
  private readonly forgotLimiter = rateLimit({
    maxRequests: config.forgotRateMax,
    windowMs: config.forgotRateWindowMs,
  })

  constructor(private readonly auth: AuthService) {}

  csrf = (_req: Request, res: Response) => {
    const token = issueCsrfToken()
    setCsrfCookie(res, token)
    res.json({ csrfToken: token })
  }

  login = async (req: Request, res: Response) => {
    if (!this.loginLimiter.check(clientIp(req))) {
      throw new TooManyRequestsError('Muitas tentativas. Tente novamente em alguns minutos.')
    }
    const dto = loginDto.parse(req.body)
    const { user, accessToken, refreshToken } = await this.auth.login(dto)
    setAccessCookie(res, accessToken)
    setRefreshCookie(res, refreshToken)
    res.json({ user })
  }

  refresh = async (req: Request, res: Response) => {
    const token = req.cookies?.refresh_token as string | undefined
    const { user, accessToken, refreshToken } = await this.auth.refresh(token)
    setAccessCookie(res, accessToken)
    setRefreshCookie(res, refreshToken)
    res.json({ user })
  }

  logout = async (req: Request, res: Response) => {
    await this.auth.logout(req.cookies?.refresh_token as string | undefined)
    clearSessionCookies(res)
    res.status(204).end()
  }

  me = async (req: Request, res: Response) => {
    const user = await this.auth.me(req.user!.id)
    res.json({ user })
  }

  forgotPassword = async (req: Request, res: Response) => {
    if (!this.forgotLimiter.check(clientIp(req))) {
      throw new TooManyRequestsError('Muitas solicitações. Tente novamente mais tarde.')
    }
    const dto = forgotPasswordDto.parse(req.body)
    await this.auth.forgotPassword(dto.email)
    res.json({ message: 'Se houver uma conta com este e-mail, enviaremos um link de redefinição.' })
  }

  resetPassword = async (req: Request, res: Response) => {
    const dto = resetPasswordDto.parse(req.body)
    await this.auth.resetPassword(dto.token, dto.password)
    res.json({ message: 'Senha redefinida com sucesso. Faça login novamente.' })
  }
}
