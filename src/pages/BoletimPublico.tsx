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
  // Prefere a URL pública absoluta (prod); em dev cai no endereço atual (sempre absoluto).
  const shareUrl =
    boletim.publicUrl && /^https?:\/\//.test(boletim.publicUrl)
      ? boletim.publicUrl
      : window.location.href

  return (
    <main className="boletim-bg min-h-screen px-4 pb-20 pt-8 md:pt-10">
      <article className="mx-auto max-w-5xl">
        {boletim.coverMediaId && (
          <img
            src={`/media/${boletim.coverMediaId}`}
            alt={boletim.title}
            className="mb-8 max-h-[28rem] w-full rounded-xl object-cover shadow-sm"
          />
        )}
        <h1 className="mb-3 text-center font-heading text-3xl font-bold text-iasd-dark md:text-4xl">
          {boletim.title}
        </h1>
        {boletim.summary && (
          <p className="mb-8 text-center text-lg text-gray-600">{boletim.summary}</p>
        )}
        <BulletinRenderer content={boletim.content} />

        <div className="mt-12 flex flex-col items-center gap-3 border-t border-gray-200 pt-8">
          <p className="text-sm text-gray-500">Gostou? Compartilhe com a igreja:</p>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${boletim.title} — ${shareUrl}`)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-5 py-3 font-medium text-white shadow-sm transition-[filter] hover:brightness-95"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
              <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
            </svg>
            Compartilhar no WhatsApp
          </a>
        </div>
      </article>
    </main>
  )
}
