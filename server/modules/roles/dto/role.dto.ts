import { z } from 'zod'

export const assignRoleDto = z.object({
  roleId: z.uuid('roleId inválido.'),
})
