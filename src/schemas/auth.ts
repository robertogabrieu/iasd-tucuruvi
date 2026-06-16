import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
})

// Espelha a política do server: 8+ com maiúscula, número e símbolo.
export const novaSenhaSchema = z.object({
  password: z.string()
    .min(8, 'Mínimo de 8 caracteres')
    .regex(/[A-Z]/, 'Inclua uma letra maiúscula')
    .regex(/[0-9]/, 'Inclua um número')
    .regex(/[^A-Za-z0-9]/, 'Inclua um símbolo'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { message: 'As senhas não conferem', path: ['confirm'] })

export const emailSchema = z.object({ email: z.email('E-mail inválido') })

export type LoginInput = z.infer<typeof loginSchema>

export const aceitarConviteSchema = z.object({
  name: z.string().min(1, 'Informe seu nome'),
  password: z.string()
    .min(8, 'Mínimo de 8 caracteres')
    .regex(/[A-Z]/, 'Inclua uma letra maiúscula')
    .regex(/[0-9]/, 'Inclua um número')
    .regex(/[^A-Za-z0-9]/, 'Inclua um símbolo'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { message: 'As senhas não conferem', path: ['confirm'] })
