import { z } from 'zod'

export const inviteDto = z.object({
  email: z.email(),
  roleKey: z.string().min(1),
})

export const acceptInviteDto = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(120),
  password: z.string().min(1), // política aplicada no value object Password (422)
})
