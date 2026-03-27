import { z } from 'zod'

export const contatoSchema = z.object({
  nome: z.string().min(2, 'Nome é obrigatório').max(100),
  telefone: z
    .string()
    .min(10, 'Telefone inválido')
    .max(15)
    .regex(/^[\d\s()+-]+$/, 'Telefone inválido'),
  email: z.string().email('Email inválido'),
  horario: z.string().min(1, 'Selecione um horário'),
  honeypot: z.string().max(0, 'Spam detectado'),
})
