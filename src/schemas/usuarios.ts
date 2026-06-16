import { z } from 'zod'

export const editarUsuarioSchema = z.object({
  name: z.string().min(1, 'Informe o nome').max(120),
  email: z.string().email('E-mail inválido'),
})
export type EditarUsuarioForm = z.infer<typeof editarUsuarioSchema>

export const convidarSchema = z.object({
  email: z.string().email('E-mail inválido'),
  roleKey: z.string().min(1, 'Escolha um papel'),
})
export type ConvidarForm = z.infer<typeof convidarSchema>
