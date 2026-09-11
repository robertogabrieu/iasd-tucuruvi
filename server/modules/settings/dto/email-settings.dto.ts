import { z } from 'zod'

/**
 * Remetente com nome de exibição opcional: "email@dominio" ou "Nome <email@dominio>". Quebra de
 * linha é recusada porque o valor vai para o cabeçalho From e permitiria injetar outros cabeçalhos.
 * Espelhado no cliente (src/schemas/settings.ts).
 */
const remetente = z.string().refine(v => {
  if (/[\r\n]/.test(v)) return false
  const endereco = v.match(/^[^<>]+<([^<>]+)>$/)?.[1] ?? v
  return z.email().safeParse(endereco.trim()).success
}, 'Remetente inválido. Use "email@dominio" ou "Nome <email@dominio>".')

export const emailSettingsDto = z.object({
  authType: z.enum(['smtp', 'gmail_oauth2']).default('smtp'),
  host: z.string().optional().default(''),
  port: z.number().int('Porta deve ser inteira.').min(1).max(65535),
  secure: z.boolean(),
  from: remetente,
  to: z.email('Destinatário inválido.'),
  authUser: z.string().optional().default(''),
  // Opcional e somente-escrita: em branco/ausente preserva a senha salva (US-14 CA-06).
  password: z.string().optional(),
}).superRefine((v, ctx) => {
  if (v.authType === 'smtp' && !v.host) ctx.addIssue({ code: 'custom', path: ['host'], message: 'Informe o host SMTP.' })
})
export type EmailSettingsInput = z.infer<typeof emailSettingsDto>

export const testEmailDto = z.object({ to: z.email('Destinatário inválido.') })
