import { sendMailWith, setEmailConfigProvider, type SmtpEmailConfig } from '../../server/lib/mail'

const mockSendMail = jest.fn()
jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: () => ({ sendMail: mockSendMail }) },
}))

const cfg: SmtpEmailConfig = {
  authType: 'smtp',
  host: 'smtp.exemplo.com',
  port: 465,
  secure: true,
  from: 'naoresponda@exemplo.com',
  to: 'painel@exemplo.com',
  authUser: 'naoresponda@exemplo.com',
  authPass: 'segredo',
}

const contato = { nome: 'Maria', telefone: '11999998888', email: 'maria@exemplo.com', horario: 'Manhã' }

beforeEach(() => {
  mockSendMail.mockReset()
  setEmailConfigProvider(async () => cfg)
})

describe('sendMailWith', () => {
  it('falls back to the configured recipient when the message has none', async () => {
    await sendMailWith(cfg, { subject: 'x' })
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'painel@exemplo.com' }))
  })
  it('keeps the recipient the message already carries', async () => {
    await sendMailWith(cfg, { subject: 'x', to: 'outro@exemplo.com' })
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'outro@exemplo.com' }))
  })
})
