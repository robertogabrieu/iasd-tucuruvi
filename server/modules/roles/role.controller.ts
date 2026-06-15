import type { Request, Response } from 'express'
import { assignRoleDto } from './dto/role.dto.js'
import type { RoleService } from './role.service.js'

export class RoleController {
  constructor(private readonly roles: RoleService) {}

  list = async (_req: Request, res: Response) => {
    res.json({ roles: await this.roles.listRoles() })
  }

  assign = async (req: Request, res: Response) => {
    const { roleId } = assignRoleDto.parse(req.body)
    await this.roles.assignRole(String(req.params.id), roleId)
    res.status(204).end()
  }

  remove = async (req: Request, res: Response) => {
    await this.roles.removeRole(String(req.params.id), String(req.params.roleId))
    res.status(204).end()
  }
}
