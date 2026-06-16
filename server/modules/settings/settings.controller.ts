import type { Request, Response } from 'express'
import { emailSettingsDto, testEmailDto } from './dto/email-settings.dto.js'
import type { SettingsService } from './settings.service.js'

export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  getEmail = async (_req: Request, res: Response) => {
    res.json({ email: await this.settings.getEmailSettings() })
  }

  putEmail = async (req: Request, res: Response) => {
    const dto = emailSettingsDto.parse(req.body)
    const email = await this.settings.updateEmailSettings(dto, req.user?.id ?? null)
    res.json({ email })
  }

  testEmail = async (req: Request, res: Response) => {
    const { to } = testEmailDto.parse(req.body)
    res.json(await this.settings.sendTestEmail(to))
  }
}
