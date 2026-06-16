import { z } from 'zod'

export const assignRoleDto = z.object({
  roleId: z.uuid('roleId inválido.'),
})

export const createRoleDto = z.object({
  name: z.string().min(1, 'Informe o nome.').max(60),
})

export const renameRoleDto = z.object({
  name: z.string().min(1, 'Informe o nome.').max(60),
})

export const setPermissionsDto = z.object({
  permissionKeys: z.array(z.string()),
})
