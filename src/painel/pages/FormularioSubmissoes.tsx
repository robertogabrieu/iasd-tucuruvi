import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import {
  baixarCsv, listarFormularios, listarSubmissoes, situacaoDoAviso,
  type FormSummary, type PageInfo, type Submission,
} from '@/painel/forms-api'
import {
  Alert, Badge, Button, EmptyState, Field, FilterBar, Input, Modal,
  PageHeader, Pager, Select, Spinner, Table, THead, td, th, type Message,
} from '@/painel/ui'

/** Filtros que moram na barra de endereço; `page` entra junto para o histórico não perder a página. */
const FILTROS = ['q', 'de', 'ate'] as const

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
  </svg>
)
const FormIcon = () => (
  <svg viewBox="0 0 24 24" className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
)
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
)

const AVISO_COR = { Enviado: 'green', Falhou: 'amber', Pendente: 'gray', 'Não configurado': 'gray' } as const

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).replace(', ', ' ')

export default function FormularioSubmissoes() {
  const { formKey = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { hasPermission } = useAuth()

  const [def, setDef] = useState<FormSummary | null>(null)
  const [rows, setRows] = useState<Submission[] | null>(null)
  const [info, setInfo] = useState<PageInfo | null>(null)
  const [aberta, setAberta] = useState<Submission | null>(null)
  const [msg, setMsg] = useState<Message | null>(null)

  const escolhas = useMemo(() => def?.fields.filter(f => f.type === 'choice') ?? [], [def])
  const colunas = useMemo(() => def?.fields.filter(f => f.inList) ?? [], [def])

  /** Um filtro está ativo quando algo além da página está na barra de endereço. */
  const temFiltro = useMemo(
    () => [...params.keys()].some(k => k !== 'page'),
    [params],
  )

  const busca = params.get('q') ?? ''
  const de = params.get('de') ?? ''
  const ate = params.get('ate') ?? ''
  const page = Number(params.get('page') ?? 1)

  function alterar(chave: string, valor: string) {
    const next = new URLSearchParams(params)
    if (valor) next.set(chave, valor); else next.delete(chave)
    next.delete('page') // filtro novo recomeça na primeira página
    setParams(next, { replace: true })
  }

  const consulta = useCallback(() => {
    const q = new URLSearchParams()
    for (const k of FILTROS) { const v = params.get(k); if (v) q.set(k, v) }
    for (const [k, v] of params) if (k.startsWith('f_') && v) q.set(k, v)
    return q
  }, [params])

  useEffect(() => {
    listarFormularios()
      .then(fs => {
        const achado = fs.find(f => f.key === formKey) ?? null
        setDef(achado)
        if (!achado) setMsg({ kind: 'err', text: 'Formulário não encontrado.' })
      })
      .catch(e => setMsg({ kind: 'err', text: (e as Error).message }))
  }, [formKey])

  useEffect(() => {
    if (!def) return
    setRows(null)
    const q = consulta()
    q.set('page', String(page))
    listarSubmissoes(formKey, q)
      .then(r => { setRows(r.data); setInfo(r.pagination) })
      .catch(e => { setRows([]); setMsg({ kind: 'err', text: (e as Error).message }) })
  }, [def, formKey, page, consulta])

  async function exportar() {
    try {
      await baixarCsv(formKey, consulta())
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message })
    }
  }

  if (!def) {
    return (
      <div className="space-y-6">
        {msg ? <Alert message={msg} /> : <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>}
      </div>
    )
  }

  const total = info?.total ?? def.total

  return (
    <div className="space-y-6">
      <PageHeader
        title={def.label}
        subtitle={`${def.description ? def.description + ' · ' : ''}${total} ${total === 1 ? 'envio' : 'envios'}`}
        actions={hasPermission('forms:export') && (
          <Button onClick={exportar} icon={<DownloadIcon />}>Exportar CSV</Button>
        )}
      />

      {msg && <Alert message={msg} />}

      <FilterBar active={temFiltro} onClear={() => setParams(new URLSearchParams(), { replace: true })}>
        <Field label="Buscar" htmlFor="q">
          <Input id="q" type="search" value={busca} placeholder="Nome, telefone ou e-mail"
            onChange={e => alterar('q', e.target.value)} />
        </Field>
        <Field label="De" htmlFor="de">
          <Input id="de" type="date" value={de} onChange={e => alterar('de', e.target.value)} />
        </Field>
        <Field label="Até" htmlFor="ate">
          <Input id="ate" type="date" value={ate} onChange={e => alterar('ate', e.target.value)} />
        </Field>
        {escolhas.map(f => (
          <Field key={f.key} label={f.label} htmlFor={`f_${f.key}`}>
            <Select id={`f_${f.key}`} value={params.get(`f_${f.key}`) ?? ''}
              onChange={e => alterar(`f_${f.key}`, e.target.value)}>
              <option value="">Todos</option>
              {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
            </Select>
          </Field>
        ))}
      </FilterBar>

      {rows === null ? (
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : rows.length === 0 ? (
        <Table>
          <tbody>
            <tr><td>
              {temFiltro ? (
                <EmptyState
                  icon={<SearchIcon />}
                  title="Nenhum envio corresponde ao filtro"
                  description={`Há ${def.total} ${def.total === 1 ? 'envio' : 'envios'} neste formulário. Tente ampliar o período ou apagar a busca.`}
                  action={<Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Limpar filtros</Button>}
                />
              ) : (
                <EmptyState
                  icon={<FormIcon />}
                  title="Nenhum envio ainda"
                  description="Assim que alguém preencher este formulário no site, o envio aparece aqui — mesmo que o aviso por e-mail falhe."
                />
              )}
            </td></tr>
          </tbody>
        </Table>
      ) : (
        <Table>
          <THead>
            <tr>
              <th className={th}>Recebido em</th>
              {colunas.map(c => <th key={c.key} className={th}>{c.label}</th>)}
              <th className={th}>Aviso</th>
              <th className={th}></th>
            </tr>
          </THead>
          <tbody>
            {rows.map(r => {
              const situacao = situacaoDoAviso(r, def.notifies)
              return (
                <tr key={r.id} onClick={() => setAberta(r)}
                  className="border-t border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer">
                  <td className={`${td} text-gray-500`}>{dataHora(r.created_at)}</td>
                  {colunas.map((c, i) => (
                    <td key={c.key} className={`${td} ${i === 0 ? 'text-iasd-accent font-medium' : 'text-gray-600'}`}>
                      {r.data[c.key] || <span className="text-gray-400">—</span>}
                    </td>
                  ))}
                  <td className={td}><Badge color={AVISO_COR[situacao]}>{situacao}</Badge></td>
                  <td className={td}>
                    <div className="flex items-center justify-end gap-3 text-gray-500">
                      <span title="Ver detalhe" className="hover:text-iasd-accent transition-colors"><EyeIcon /></span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}

      {info && <Pager info={info} onPage={p => alterar('page', String(p))} />}

      {aberta && (
        <Modal title={def.label} size="lg" onClose={() => setAberta(null)}>
          <dl className="divide-y divide-gray-100">
            {def.fields.map(f => (
              <div key={f.key} className="grid grid-cols-3 gap-4 py-3">
                <dt className="text-sm text-gray-500">{f.label}</dt>
                <dd className="col-span-2 text-sm text-gray-900 break-words">
                  {aberta.data[f.key] || <span className="text-gray-400">—</span>}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 pt-4 border-t border-gray-200 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
            <span>Recebido em {dataHora(aberta.created_at)}</span>
            <span>
              Aviso por e-mail: {situacaoDoAviso(aberta, def.notifies).toLowerCase()}
              {aberta.notify_error && ` — ${aberta.notify_error}`}
            </span>
            {aberta.submitted_ip && <span>Origem {aberta.submitted_ip}</span>}
          </div>
        </Modal>
      )}
    </div>
  )
}
