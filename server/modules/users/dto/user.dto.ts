import { z } from 'zod'

/** Edição parcial: pelo menos um campo. */
export const updateUserDto = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.email().optional(),
}).refine(d => d.name !== undefined || d.email !== undefined, {
  message: 'Informe ao menos um campo para atualizar.',
})

export const setStatusDto = z.object({
  status: z.enum(['active', 'disabled']),
})
