import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ensureCsrf } from '@/auth/auth-api'
import { usePagination, type PageInfo } from '@/painel/usePagination'
import { createEvento, dataDoEvento, deleteEvento, listEventos, type Evento } from '@/painel/eventos-api'
import {
  Alert, Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Pager, Spinner,
  Table, THead, td, th,
} from '@/painel/ui'

type FiltroDeStatus = 'todos' | 'draft' | 'published'
type FiltroDePeriodo = 'todos' | 'proximos' | 'passados'

const STATUS: { value: FiltroDeStatus; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'draft', label: 'Rascunhos' },
  { value: 'published', label: 'Publicados' },
]

const PERIODO: { value: FiltroDePeriodo; label: string }[] = [
  { value: 'todos', label: 'Qualquer data' },
  { value: 'proximos', label: 'Próximos' },
  { value: 'passados', label: 'Já aconteceram' },
]

const icone = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

const I = {
  editar: 'M4 20h4l10-10a2.8 2.8 0 10-4-4L4 16v4z',
  verPagina: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
  excluir: 'M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13',
  calendario: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
}

export default function EventosLista() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { page, limit, setPage } = usePagination()
  const [items, setItems] = useState<Evento[]>([])
  const [info, setInfo] = useState<PageInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [status, setStatus] = useState<FiltroDeStatus>('todos')
  const [periodo, setPeriodo] = useState<FiltroDePeriodo>('todos')
  const [criando, setCriando] = useState(params.get('novo') === '1')
  const [aExcluir, setAExcluir] = useState<Evento | null>(null)

  const filtrando = status !== 'todos' || periodo !== 'todos'

  const carregar = useCallback(async () => {
    await ensureCsrf()
    try {
      const body = await listEventos(page, limit, {
        status: status === 'todos' ? undefined : status,
        periodo: periodo === 'todos' ? undefined : periodo,
      })
      setErro(null)
      setItems(body.data)
      setInfo(body.pagination)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [page, limit, status, periodo])

  useEffect(() => {
    setLoading(true)
    carregar()
  }, [carregar])

  function abrirCriacao() {
    setCriando(true)
  }

  function fecharCriacao() {
    setCriando(false)
    if (params.get('novo')) {
      params.delete('novo')
      setParams(params, { replace: true })
    }
  }

  function limparFiltros() {
    setStatus('todos')
    setPeriodo('todos')
    setPage(1)
  }

  async function excluir(evento: Evento) {
    setAExcluir(null)
    try {
      await ensureCsrf()
      await deleteEvento(evento.id)
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Eventos"
        subtitle="Cada evento vira uma página com link próprio, pronta para mandar no grupo."
        actions={<Button onClick={abrirCriacao}>Novo evento</Button>}
      />

      {erro && <Alert kind="err">{erro}</Alert>}

      <div className="flex flex-wrap gap-4">
        <FiltroEmBotoes
          rotulo="Situação"
          opcoes={STATUS}
          valor={status}
          onChange={v => { setStatus(v); setPage(1) }}
        />
        <FiltroEmBotoes
          rotulo="Data"
          opcoes={PERIODO}
          valor={periodo}
          onChange={v => { setPeriodo(v); setPage(1) }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
      ) : items.length === 0 && filtrando ? (
        <EmptyState
          title="Nenhum evento com esses filtros"
          description="Nada foi encontrado para a combinação escolhida. Outros eventos podem existir fora dela."
          action={<Button variant="secondary" onClick={limparFiltros}>Limpar filtros</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={icone(I.calendario)}
          title="Nenhum evento ainda"
          description="Aqui você monta a página de cada evento da igreja — data, local, quem conduz e a capa. Publicado, ele ganha um link para o grupo do WhatsApp e aparece na agenda do site."
          action={<Button onClick={abrirCriacao}>Criar o primeiro evento</Button>}
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <th className={th}>Evento</th>
              <th className={th}>Quando</th>
              <th className={th}>Situação</th>
              <th className={th}></th>
            </tr>
          </THead>
          <tbody>
            {items.map(evento => (
              <tr key={evento.id} className="border-t border-gray-100 transition-colors hover:bg-gray-50">
                <td className={td}>
                  <button
                    onClick={() => navigate(`/painel/eventos/${evento.id}`)}
                    className="text-left font-medium text-iasd-accent hover:underline"
                  >
                    {evento.title}
                  </button>
                  {evento.locationName && (
                    <p className="text-xs text-gray-500">{evento.locationName}</p>
                  )}
                </td>
                <td className={`${td} text-gray-600`}>{dataDoEvento(evento.startsAt)}</td>
                <td className={td}><SituacaoDoEvento status={evento.status} /></td>
                <td className={td}>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost" size="sm" title="Editar" aria-label={`Editar ${evento.title}`}
                      icon={icone(I.editar)}
                      onClick={() => navigate(`/painel/eventos/${evento.id}`)}
                    />
                    {evento.status === 'published' && evento.publicUrl && (
                      <a
                        href={evento.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Ver página"
                        aria-label={`Ver a página de ${evento.title}`}
                        className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-iasd-dark transition-colors hover:bg-gray-100"
                      >
                        {icone(I.verPagina)}
                      </a>
                    )}
                    <Button
                      variant="ghost" size="sm" title="Excluir" aria-label={`Excluir ${evento.title}`}
                      icon={icone(I.excluir)}
                      className="text-red-700 hover:bg-red-50"
                      onClick={() => setAExcluir(evento)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {!loading && info && items.length > 0 && <Pager info={info} onPage={setPage} />}

      {criando && (
        <ModalDeCriacao
          onClose={fecharCriacao}
          onCriado={evento => navigate(`/painel/eventos/${evento.id}`)}
        />
      )}

      {aExcluir && (
        <Modal title="Excluir evento" onClose={() => setAExcluir(null)}>
          <p className="mb-4 text-sm text-gray-600">
            Remover <strong>{aExcluir.title}</strong>? Se ele estiver publicado, o link deixa de abrir.
            Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAExcluir(null)}>Cancelar</Button>
            <Button variant="danger" onClick={() => excluir(aExcluir)}>Excluir</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function SituacaoDoEvento({ status }: { status: Evento['status'] }) {
  const publicado = status === 'published'
  return (
    <Badge color={publicado ? 'green' : 'amber'}>
      <span className={`h-1.5 w-1.5 rounded-full ${publicado ? 'bg-green-500' : 'bg-amber-500'}`} />
      {publicado ? 'Publicado' : 'Rascunho'}
    </Badge>
  )
}

function FiltroEmBotoes<T extends string>({
  rotulo, opcoes, valor, onChange,
}: {
  rotulo: string
  opcoes: { value: T; label: string }[]
  valor: T
  onChange: (v: T) => void
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-gray-500">{rotulo}</p>
      <div className="flex gap-2">
        {opcoes.map(o => (
          <Button
            key={o.value}
            size="sm"
            variant={o.value === valor ? 'primary' : 'secondary'}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

function ModalDeCriacao({
  onClose, onCriado,
}: {
  onClose: () => void
  onCriado: (evento: Evento) => void
}) {
  const [titulo, setTitulo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function criar() {
    const limpo = titulo.trim()
    if (!limpo) { setErro('Informe o nome do evento.'); return }
    setErro(null)
    setOcupado(true)
    try {
      await ensureCsrf()
      onCriado(await createEvento(limpo))
    } catch (e) {
      setErro((e as Error).message)
      setOcupado(false)
    }
  }

  return (
    <Modal title="Novo evento" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nome do evento">
          <Input
            autoFocus
            value={titulo}
            disabled={ocupado}
            maxLength={200}
            placeholder="Ex.: Vigília de Oração dos Jovens"
            onChange={e => setTitulo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') criar() }}
          />
        </Field>
        <p className="text-sm text-gray-500">
          O resto — data, local, capa — você preenche na próxima tela. Nada aparece no site
          antes de você publicar.
        </p>
        {erro && <Alert kind="err">{erro}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={ocupado}>Cancelar</Button>
          <Button onClick={criar} disabled={ocupado}>{ocupado ? 'Criando…' : 'Criar'}</Button>
        </div>
      </div>
    </Modal>
  )
}
