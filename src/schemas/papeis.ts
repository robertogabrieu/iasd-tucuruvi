import { z } from 'zod'

export const papelNomeSchema = z.object({
  name: z.string().min(1, 'Informe o nome').max(60),
})
export type PapelNomeForm = z.infer<typeof papelNomeSchema>
