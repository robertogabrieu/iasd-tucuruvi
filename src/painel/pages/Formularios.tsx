import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarFormularios, type FormSummary } from '@/painel/forms-api'
import { PageHeader, Spinner, EmptyState, Alert, type Message } from '@/painel/ui'

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

export default function Formularios() {
  const [forms, setForms] = useState<FormSummary[] | null>(null)
  const [msg, setMsg] = useState<Message | null>(null)

  useEffect(() => {
    listarFormularios().then(setForms).catch(e => {
      setForms([])
      setMsg({ kind: 'err', text: (e as Error).message })
    })
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Formulários"
        subtitle="Tudo que as pessoas enviam pelo site fica guardado aqui."
      />

      {msg && <Alert message={msg} />}

      {forms === null ? (
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : forms.length === 0 ? (
        <EmptyState
          title="Nenhum formulário publicado"
          description="Quando um formulário for adicionado ao site, ele aparece aqui com os envios recebidos."
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {forms.map(f => (
            <Link
              key={f.key}
              to={`/painel/formularios/${f.key}`}
              className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 block hover:border-iasd-accent transition-colors"
            >
              <h2 className="font-heading font-bold text-iasd-dark">{f.label}</h2>
              {f.description && <p className="text-sm text-gray-500 mt-1">{f.description}</p>}
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-2xl font-heading font-bold text-iasd-dark">{f.total}</span>
                <span className="text-sm text-gray-500">
                  {f.total === 1 ? 'envio' : 'envios'}
                  {f.lastAt && ` · último em ${dataCurta(f.lastAt)}`}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
