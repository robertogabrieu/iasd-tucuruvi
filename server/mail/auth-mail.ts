import { sendMail } from '../lib/mail.js'
import { config } from '../core/config.js'

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${config.appBaseUrl}/redefinir-senha?token=${encodeURIComponent(token)}`
  await sendMail({
    to,
    subject: 'Redefinição de senha — Painel IASD Tucuruvi',
    html: `
      <h2>Redefinição de senha</h2>
      <p>Recebemos um pedido para redefinir sua senha. O link abaixo vale por ${config.passwordResetTtlMin} minutos:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Se você não solicitou, ignore este e-mail.</p>
    `,
  })
}

export async function sendInvitationEmail(to: string, token: string): Promise<void> {
  const link = `${config.appBaseUrl}/aceitar-convite?token=${encodeURIComponent(token)}`
  await sendMail({
    to,
    subject: 'Convite — Painel IASD Tucuruvi',
    html: `
      <h2>Você foi convidado para o painel da IASD Tucuruvi</h2>
      <p>Para ativar seu acesso, defina sua senha pelo link abaixo (válido por ${config.invitationTtlDays} dias):</p>
      <p><a href="${link}">${link}</a></p>
      <p>Se você não esperava este convite, ignore este e-mail.</p>
    `,
  })
}
