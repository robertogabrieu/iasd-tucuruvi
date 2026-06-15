import type { Request, Response } from 'express'
import { inviteDto, acceptInviteDto } from './dto/invitation.dto.js'
import { setAccessCookie, setRefreshCookie } from '../auth/auth.cookies.js'
import type { InvitationService } from './invitation.service.js'

export class InvitationController {
  constructor(private readonly invitations: InvitationService) {}

  invite = async (req: Request, res: Response) => {
    const dto = inviteDto.parse(req.body)
    const invite = await this.invitations.invite({
      email: dto.email,
      roleKey: dto.roleKey,
      invitedBy: req.user!.id,
    })
    res.status(201).json({ invite })
  }

  accept = async (req: Request, res: Response) => {
    const dto = acceptInviteDto.parse(req.body)
    const { user, accessToken, refreshToken } = await this.invitations.acceptInvite(dto)
    setAccessCookie(res, accessToken)
    setRefreshCookie(res, refreshToken)
    res.status(201).json({ user })
  }
}
