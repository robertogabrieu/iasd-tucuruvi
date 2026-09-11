import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EventoRenderer from '@/components/evento/EventoRenderer'
import type { EventoDTO } from '@/schemas/evento'
import { Spinner } from '@/painel/ui'

type Estado =
  | { status: 'carregando' }
  | { status: 'naoencontrado' }
  | { status: 'ok'; evento: EventoDTO }

/**
 * A página que o link compartilhado abre. Sem autenticação: o endpoint público só devolve
 * evento publicado, então rascunho e slug inexistente caem no mesmo 404.
 */
export default function EventoPublico() {
  const { slug = '' } = useParams()
  const [estado, setEstado] = useState<Estado>({ status: 'carregando' })

  useEffect(() => {
    let ativo = true
    setEstado({ status: 'carregando' })
    ;(async () => {
      try {
        const res = await fetch(`/api/eventos/${encodeURIComponent(slug)}`)
        if (!ativo) return
        if (!res.ok) {
          setEstado({ status: 'naoencontrado' })
          return
        }
        const body = await res.json()
        setEstado({ status: 'ok', evento: body.evento })
      } catch {
        if (ativo) setEstado({ status: 'naoencontrado' })
      }
    })()
    return () => {
      ativo = false
    }
  }, [slug])

  if (estado.status === 'carregando') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-iasd-light">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (estado.status === 'naoencontrado') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-iasd-light px-4 text-center">
        <h1 className="font-heading text-2xl font-bold text-iasd-dark">Evento não encontrado</h1>
        <p className="text-gray-600">Este evento não está publicado ou o link mudou.</p>
        <Link to="/eventos" className="font-medium text-iasd-accent underline">
          Ver os próximos eventos
        </Link>
      </div>
    )
  }

  // Em produção o link absoluto vem do servidor; em dev cai no endereço atual, sempre absoluto.
  const link =
    estado.evento.publicUrl && /^https?:\/\//.test(estado.evento.publicUrl)
      ? estado.evento.publicUrl
      : window.location.href

  return <EventoRenderer evento={estado.evento} link={link} />
}
