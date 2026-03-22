import { NextResponse } from 'next/server'
import { contatoSchema } from '@/schemas/contato'
import { sanitize } from '@/lib/sanitize'
import { rateLimit } from '@/lib/rate-limit'
import { sendContatoEmail } from '@/lib/mail'

const limiter = rateLimit({ maxRequests: 5, windowMs: 60_000 })

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  if (!limiter.check(ip)) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const result = contatoSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const data = {
    nome: sanitize(result.data.nome),
    telefone: sanitize(result.data.telefone),
    email: sanitize(result.data.email),
    horario: sanitize(result.data.horario),
  }

  try {
    await sendContatoEmail(data)
  } catch {
    return NextResponse.json({ error: 'Erro ao enviar mensagem.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Mensagem enviada com sucesso!' })
}
