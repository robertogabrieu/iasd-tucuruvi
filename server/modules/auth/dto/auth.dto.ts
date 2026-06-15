import { z } from 'zod'

export const loginDto = z.object({
  email: z.email(),
  password: z.string().min(1),
})

export const forgotPasswordDto = z.object({
  email: z.email(),
})

export const resetPasswordDto = z.object({
  token: z.string().min(1),
  password: z.string().min(1), // política aplicada no value object Password (422)
})
