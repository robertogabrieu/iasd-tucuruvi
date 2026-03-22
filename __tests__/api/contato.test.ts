import { POST } from '@/app/api/contato/route'

// Mock mail to avoid real SMTP in tests
jest.mock('@/lib/mail', () => ({
  sendContatoEmail: jest.fn().mockResolvedValue(undefined),
}))

function makeRequest(body: Record<string, string>) {
  return new Request('http://localhost:3000/api/contato', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/contato', () => {
  it('rejects invalid data with 400', async () => {
    const res = await POST(makeRequest({ nome: '' }))
    expect(res.status).toBe(400)
  })

  it('rejects honeypot filled with 400', async () => {
    const res = await POST(
      makeRequest({
        nome: 'Test',
        telefone: '11999998888',
        email: 'test@test.com',
        horario: 'Manhã',
        honeypot: 'bot',
      })
    )
    expect(res.status).toBe(400)
  })

  it('accepts valid data and returns 200', async () => {
    const res = await POST(
      makeRequest({
        nome: 'Maria Silva',
        telefone: '11999998888',
        email: 'maria@email.com',
        horario: 'Manhã',
        honeypot: '',
      })
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })
})
