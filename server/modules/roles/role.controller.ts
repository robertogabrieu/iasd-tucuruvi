import type { Request, Response } from 'express'
import { assignRoleDto, createRoleDto, renameRoleDto, setPermissionsDto } from './dto/role.dto.js'
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

  listManaged = async (_req: Request, res: Response) => {
    res.json({ roles: await this.roles.listManaged() })
  }

  listPermissions = async (_req: Request, res: Response) => {
    res.json({ permissions: await this.roles.listPermissionCatalog() })
  }

  create = async (req: Request, res: Response) => {
    const { name } = createRoleDto.parse(req.body)
    res.status(201).json({ role: await this.roles.createRole(name) })
  }

  rename = async (req: Request, res: Response) => {
    const { name } = renameRoleDto.parse(req.body)
    await this.roles.renameRole(String(req.params.id), name)
    res.status(204).end()
  }

  setPermissions = async (req: Request, res: Response) => {
    const { permissionKeys } = setPermissionsDto.parse(req.body)
    await this.roles.setPermissions(String(req.params.id), permissionKeys)
    res.status(204).end()
  }

  deleteRole = async (req: Request, res: Response) => {
    await this.roles.deleteRole(String(req.params.id))
    res.status(204).end()
  }
}
