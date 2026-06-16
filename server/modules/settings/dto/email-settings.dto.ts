import { z } from 'zod'

export const emailSettingsDto = z.object({
  host: z.string().min(1, 'Informe o host SMTP.'),
  port: z.number().int('Porta deve ser inteira.').min(1).max(65535),
  secure: z.boolean(),
  from: z.email('Remetente inválido.'),
  to: z.email('Destinatário inválido.'),
  authUser: z.string().optional().default(''),
  // Opcional e somente-escrita: em branco/ausente preserva a senha salva (US-14 CA-06).
  password: z.string().optional(),
})
export type EmailSettingsInput = z.infer<typeof emailSettingsDto>

export const testEmailDto = z.object({ to: z.email('Destinatário inválido.') })
