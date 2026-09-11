import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ensureCsrf } from '@/auth/auth-api'
import EventoRenderer from '@/components/evento/EventoRenderer'
import { getEvento, type Evento } from '@/painel/eventos-api'
import { Spinner } from '@/painel/ui'

/**
 * A página do evento como ela vai ficar, buscada pela API administrativa — funciona em
 * rascunho, que é justamente quando quem publica precisa ver antes de decidir.
 */
export default function EventoPreview() {
  const { id = '' } = useParams()
  const [evento, setEvento] = useState<Evento | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    ;(async () => {
      setCarregando(true)
      await ensureCsrf()
      try {
        const e = await getEvento(id)
        if (ativo) setEvento(e)
      } catch (e) {
        if (ativo) setErro((e as Error).message)
      } finally {
        if (ativo) setCarregando(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [id])

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-iasd-light">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (erro || !evento) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-iasd-light px-4">
        <p className="text-center text-gray-600">{erro ?? 'Evento não encontrado.'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-iasd-light">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-3 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
          Pré-visualização — {evento.status === 'published' ? 'evento publicado' : 'ainda em rascunho'}
        </p>
        <Link to={`/painel/eventos/${evento.id}`} className="text-xs font-medium text-iasd-accent underline">
          Voltar ao formulário
        </Link>
      </div>
      <EventoRenderer evento={evento} link={evento.publicUrl} />
    </div>
  )
}
