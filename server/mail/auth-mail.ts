import { transporter } from '../lib/mail.js'
import { config } from '../core/config.js'

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${config.appBaseUrl}/redefinir-senha?token=${encodeURIComponent(token)}`
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@iasdtucuruvi.com.br',
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
