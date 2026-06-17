import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ensureCsrf } from '@/auth/auth-api'
import { getBoletim, type Boletim } from '@/painel/boletim-api'
import BulletinRenderer from '@/components/boletim/BulletinRenderer'
import { Spinner } from '@/painel/ui'

/**
 * Pré-visualização do boletim (última versão salva). Montada sob /painel, herda a
 * ProtectedRoute. Renderiza fora do chrome do painel, em um layout limpo e on-brand,
 * próximo da futura página pública.
 */
export default function BoletimPreview() {
  const { id = '' } = useParams()
  const [boletim, setBoletim] = useState<Boletim | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      await ensureCsrf()
      try {
        const b = await getBoletim(id)
        if (active) setBoletim(b)
      } catch (e) {
        if (active) setError((e as Error).message)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-iasd-light">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (error || !boletim) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-iasd-light px-4">
        <p className="text-center text-gray-600">{error ?? 'Boletim não encontrado.'}</p>
      </div>
    )
  }

  return (
    <main className="boletim-bg min-h-screen px-4 pb-20 pt-10 md:px-8">
      <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-gray-400">
        Pré-visualização — última versão salva
      </p>
      <article className="w-full">
        <h1 className="mb-8 text-center font-heading text-3xl font-bold text-iasd-dark md:text-4xl">
          {boletim.title}
        </h1>
        <BulletinRenderer content={boletim.content} />
      </article>
    </main>
  )
}
