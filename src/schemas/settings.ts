import { z } from 'zod'

/**
 * Remetente com nome de exibição opcional: "email@dominio" ou "Nome <email@dominio>". Quebra de
 * linha é recusada porque o valor vai para o cabeçalho From e permitiria injetar outros cabeçalhos.
 * Espelha o server (server/modules/settings/dto/email-settings.dto.ts).
 */
export const remetenteSchema = z.string().refine(v => {
  if (/[\r\n]/.test(v)) return false
  const endereco = v.match(/^[^<>]+<([^<>]+)>$/)?.[1] ?? v
  return z.email().safeParse(endereco.trim()).success
}, 'Remetente inválido. Use "email@dominio" ou "Nome <email@dominio>".')

export const emailSettingsSchema = z
  .object({
    authType: z.enum(['smtp', 'gmail_oauth2']).default('smtp'),
    // host só é obrigatório no modo SMTP — validado no superRefine abaixo (espelha o server).
    host: z.string().optional().default(''),
    // Divergência intencional do server (z.number): o input HTML é string; z.coerce converte para number
    // antes do JSON.stringify, então o server recebe number. NÃO trocar por z.number aqui.
    port: z.coerce.number().int('Porta deve ser inteira.').min(1, 'Porta inválida.').max(65535, 'Porta inválida.'),
    secure: z.boolean(),
    from: remetenteSchema,
    to: z.email('Destinatário inválido.'),
    authUser: z.string().optional(),
    password: z.string().optional(), // somente-escrita: em branco preserva a salva
  })
  .superRefine((v, ctx) => {
    if (v.authType === 'smtp' && !v.host) {
      ctx.addIssue({ code: 'custom', path: ['host'], message: 'Informe o host SMTP.' })
    }
  })
export type EmailSettingsForm = z.infer<typeof emailSettingsSchema>
// Tipo de ENTRADA do schema: por causa de z.coerce.number() em `port`, o input difere do
// output (port: unknown na entrada, number na saída). O formulário usa este tipo nos campos
// e o EmailSettingsForm (saída) no submit transformado. Ver useForm em Configuracoes.tsx.
export type EmailSettingsFormInput = z.input<typeof emailSettingsSchema>
