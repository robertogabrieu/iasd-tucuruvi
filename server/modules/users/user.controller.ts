import type { Request, Response } from 'express'
import { paginationQuery } from '../../core/pagination.js'
import { updateUserDto, setStatusDto } from './dto/user.dto.js'
import type { UserService } from './user.service.js'

export class UserController {
  constructor(private readonly users: UserService) {}

  list = async (req: Request, res: Response) => {
    const params = paginationQuery.parse(req.query)
    res.json(await this.users.list(params))
  }

  get = async (req: Request, res: Response) => {
    res.json({ user: await this.users.get(String(req.params.id)) })
  }

  update = async (req: Request, res: Response) => {
    const dto = updateUserDto.parse(req.body)
    await this.users.update(String(req.params.id), dto)
    res.status(204).end()
  }

  setStatus = async (req: Request, res: Response) => {
    const { status } = setStatusDto.parse(req.body)
    await this.users.setStatus(String(req.params.id), status)
    res.status(204).end()
  }

  unlock = async (req: Request, res: Response) => {
    await this.users.unlock(String(req.params.id))
    res.status(204).end()
  }

  passwordReset = async (req: Request, res: Response) => {
    await this.users.triggerPasswordReset(String(req.params.id))
    res.status(204).end()
  }
}
