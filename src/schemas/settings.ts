import { z } from 'zod'

export const emailSettingsSchema = z.object({
  host: z.string().min(1, 'Informe o host SMTP.'),
  // Divergência intencional do server (z.number): o input HTML é string; z.coerce converte para number
  // antes do JSON.stringify, então o server recebe number. NÃO trocar por z.number aqui.
  port: z.coerce.number().int('Porta deve ser inteira.').min(1, 'Porta inválida.').max(65535, 'Porta inválida.'),
  secure: z.boolean(),
  from: z.email('Remetente inválido.'),
  to: z.email('Destinatário inválido.'),
  authUser: z.string().optional(),
  password: z.string().optional(), // somente-escrita: em branco preserva a salva
})
export type EmailSettingsForm = z.infer<typeof emailSettingsSchema>
// Tipo de ENTRADA do schema: por causa de z.coerce.number() em `port`, o input difere do
// output (port: unknown na entrada, number na saída). O formulário usa este tipo nos campos
// e o EmailSettingsForm (saída) no submit transformado. Ver useForm em Configuracoes.tsx.
export type EmailSettingsFormInput = z.input<typeof emailSettingsSchema>
