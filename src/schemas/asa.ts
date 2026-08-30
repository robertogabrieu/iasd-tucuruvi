import { z } from 'zod'

export const asaSchema = z.object({
  nome: z.string().min(2, 'Escreva seu nome completo').max(120),
  telefone: z
    .string()
    .min(10, 'Informe DDD e número')
    .max(20)
    .regex(/^[\d\s()+-]+$/, 'Telefone inválido'),
  email: z.union([z.literal(''), z.string().email('E-mail inválido').max(150)]),
  bairro: z.string().min(2, 'Informe o bairro onde você mora').max(120),
  endereco: z.string().max(200),
  horario: z.string().min(1, 'Escolha o melhor horário para o contato'),
  pessoas: z.string().min(1, 'Informe quantas pessoas moram com você'),
  perfil: z.array(z.string().max(60)).max(10),
  ajuda: z.array(z.string().max(60)).min(1, 'Marque ao menos um tipo de ajuda').max(10),
  situacao: z.string().min(10, 'Conte um pouco mais para a equipe entender a situação').max(1000),
  urgencia: z.string().min(1, 'Escolha a urgência do pedido'),
  consentimento: z
    .boolean()
    .refine((v) => v, 'Precisamos da sua autorização para entrar em contato'),
  honeypot: z.string().max(0, 'Spam detectado'),
})

export type AsaFormData = z.infer<typeof asaSchema>
