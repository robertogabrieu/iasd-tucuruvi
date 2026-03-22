import nodemailer from 'nodemailer'

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT) || 1025,
  secure: false,
})

interface EmailData {
  nome: string
  telefone: string
  email: string
  horario: string
}

export async function sendContatoEmail(data: EmailData) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@iasdtucuruvi.com.br',
    to: process.env.SMTP_TO || 'contato@iasdtucuruvi.com.br',
    subject: `Novo pedido de estudo bíblico — ${data.nome}`,
    html: `
      <h2>Novo pedido de estudo bíblico</h2>
      <p><strong>Nome:</strong> ${data.nome}</p>
      <p><strong>Telefone/WhatsApp:</strong> ${data.telefone}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Melhor horário:</strong> ${data.horario}</p>
    `,
  })
}
