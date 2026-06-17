import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Boletim } from '@/painel/boletim-api'
import BulletinRenderer from '@/components/boletim/BulletinRenderer'
import { Spinner } from '@/painel/ui'

type State =
  | { status: 'loading' }
  | { status: 'notfound' }
  | { status: 'ok'; boletim: Boletim }

/**
 * Página pública do boletim (o que o link compartilhado abre). Sem autenticação;
 * busca o endpoint público que só retorna boletins publicados (404 caso contrário).
 */
export default function BoletimPublico() {
  const { slug = '' } = useParams()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    ;(async () => {
      try {
        const res = await fetch(`/api/boletins/${encodeURIComponent(slug)}`)
        if (!active) return
        if (!res.ok) {
          setState({ status: 'notfound' })
          return
        }
        const body = await res.json()
        setState({ status: 'ok', boletim: body.boletim })
      } catch {
        if (active) setState({ status: 'notfound' })
      }
    })()
    return () => {
      active = false
    }
  }, [slug])

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-iasd-light">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (state.status === 'notfound') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-iasd-light px-4 text-center">
        <h1 className="font-heading text-2xl font-bold text-iasd-dark">Boletim não encontrado</h1>
        <p className="text-gray-600">Este boletim não está disponível ou o link expirou.</p>
        <a href="/" className="font-medium text-iasd-accent underline">Voltar ao site</a>
      </div>
    )
  }

  const { boletim } = state

  return (
    <main className="min-h-screen bg-iasd-light pb-20 pt-12">
      <article className="container mx-auto max-w-3xl px-4">
        {boletim.coverMediaId && (
          <img
            src={`/media/${boletim.coverMediaId}`}
            alt={boletim.title}
            className="mb-8 max-h-96 w-full rounded-xl object-cover shadow-sm"
          />
        )}
        <h1 className="mb-3 text-center font-heading text-3xl font-bold text-iasd-dark md:text-4xl">
          {boletim.title}
        </h1>
        {boletim.summary && (
          <p className="mb-8 text-center text-lg text-gray-600">{boletim.summary}</p>
        )}
        <BulletinRenderer content={boletim.content} />
      </article>
    </main>
  )
}
