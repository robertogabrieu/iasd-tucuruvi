import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { ensureCsrf } from '@/auth/auth-api'
import CapaEvento, { type ValoresDaCapa } from '@/painel/components/CapaEvento'
import FotoComRecorte from '@/painel/components/FotoComRecorte'
import TextBlockEditor from '@/painel/components/blocks/TextBlockEditor'
import {
  EventoIncompletoError, cartaoDaPendencia, deCampoDeDataHora, despublicarEvento, getEvento,
  mensagemDeCompartilhamento, paraCampoDeDataHora, publicarEvento, updateEvento,
  type CartaoDoEvento, type Evento, type EventoPatch,
} from '@/painel/eventos-api'
import { CATEGORIES, type TipTapDoc } from '@/schemas/evento'
import {
  Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Spinner, type Message,
} from '@/painel/ui'

interface Campos extends ValoresDaCapa {
  title: string
  summary: string
  description: TipTapDoc
  category: string
  inicio: string
  termino: string
  locationName: string
  locationAddress: string
  hostName: string
  hostRole: string
  hostPhotoMediaId: string | null
  ctaLabel: string
  ctaUrl: string
}

const NOME_DO_CARTAO: Record<CartaoDoEvento, string> = {
  sobre: 'Sobre o evento',
  quando: 'Quando e onde',
  responsavel: 'Responsável',
  capa: 'Capa',
  acao: 'Botão de ação',
}

const DESCRICAO_VAZIA: TipTapDoc = { type: 'doc', content: [] }

const ICONE_COPIAR = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" strokeLinecap="round" />
  </svg>
)

const ICONE_OK = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

const ICONE_WHATSAPP = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5.1-1.4A10 10 0 1012 2z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M9.2 7.6h-.7c-.25 0-.6.1-.9.45-.3.35-1.1 1.05-1.1 2.6s1.15 3 1.3 3.2c.15.2 2.2 3.4 5.4 4.7 2 .8 2.75.85 3.6.75.7-.1 1.8-.75 2.05-1.45.25-.7.25-1.3.2-1.45-.1-.15-.35-.25-.7-.4-.35-.2-1.85-.95-2.15-1.05-.3-.1-.5-.15-.75.2-.2.3-.75 1-.9 1.2-.2.2-.35.2-.65.05-1.8-.9-3.05-1.7-4.2-3.7-.3-.55.3-.5.85-1.6.1-.2.05-.4-.05-.55-.1-.15-.75-1.75-1-2.4-.25-.6-.5-.55-.7-.55z" fill="currentColor" />
  </svg>
)

const ICONE_STORIES = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <rect x="6" y="2" width="12" height="20" rx="2.5" />
    <path d="M12 8v6M9.4 11.6 12 14.2l2.6-2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function daApi(e: Evento): Campos {
  return {
    title: e.title,
    summary: e.summary ?? '',
    description: e.description ?? DESCRICAO_VAZIA,
    category: e.category ?? '',
    inicio: paraCampoDeDataHora(e.startsAt),
    termino: paraCampoDeDataHora(e.endsAt),
    locationName: e.locationName ?? '',
    locationAddress: e.locationAddress ?? '',
    coverMode: e.coverMode,
    coverStyle: e.coverStyle,
    accentColor: e.accentColor,
    secondaryColor: e.secondaryColor,
    artMediaId: e.artMediaId,
    hostName: e.hostName ?? '',
    hostRole: e.hostRole ?? '',
    hostPhotoMediaId: e.hostPhotoMediaId,
    ctaLabel: e.ctaLabel ?? '',
    ctaUrl: e.ctaUrl ?? '',
  }
}

/** Campo de texto vazio vira null: é assim que a API distingue "não preenchido" de "em branco". */
function ouNulo(valor: string): string | null {
  return valor.trim() || null
}

function paraApi(c: Campos): EventoPatch {
  const inicio = deCampoDeDataHora(c.inicio)
  return {
    title: c.title.trim(),
    summary: ouNulo(c.summary),
    description: c.description,
    category: ouNulo(c.category),
    ...(inicio ? { startsAt: inicio } : {}),
    endsAt: deCampoDeDataHora(c.termino),
    locationName: c.locationName.trim(),
    locationAddress: ouNulo(c.locationAddress),
    coverMode: c.coverMode,
    coverStyle: c.coverStyle,
    accentColor: c.accentColor,
    secondaryColor: c.secondaryColor,
    artMediaId: c.artMediaId,
    hostName: ouNulo(c.hostName),
    hostRole: ouNulo(c.hostRole),
    hostPhotoMediaId: c.hostPhotoMediaId,
    ctaLabel: ouNulo(c.ctaLabel),
    ctaUrl: ouNulo(c.ctaUrl),
  }
}

export default function EventoEditor() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  const [evento, setEvento] = useState<Evento | null>(null)
  const [campos, setCampos] = useState<Campos | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erroDeCarga, setErroDeCarga] = useState<string | null>(null)
  const [msg, setMsg] = useState<Message | null>(null)
  const [pendencias, setPendencias] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const hidratar = useCallback((e: Evento) => {
    setEvento(e)
    setCampos(daApi(e))
  }, [])

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    ensureCsrf()
      .then(() => getEvento(id))
      .then(e => { if (vivo) { hidratar(e); setErroDeCarga(null) } })
      .catch(e => { if (vivo) setErroDeCarga((e as Error).message) })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [id, hidratar])

  function alterar(patch: Partial<Campos>) {
    setCampos(atual => (atual ? { ...atual, ...patch } : atual))
  }

  async function salvar(): Promise<Evento | null> {
    if (!campos) return null
    if (!campos.title.trim()) {
      setMsg({ kind: 'err', text: 'Dê um nome ao evento antes de salvar.' })
      return null
    }
    const atualizado = await updateEvento(id, paraApi(campos))
    hidratar(atualizado)
    return atualizado
  }

  async function aoSalvar() {
    setMsg(null)
    setSalvando(true)
    try {
      if (await salvar()) setMsg({ kind: 'ok', text: 'Evento salvo.' })
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setSalvando(false)
    }
  }

  async function aoPublicar() {
    setMsg(null)
    setPendencias([])
    setOcupado(true)
    try {
      // Publica sobre o que está salvo: sem salvar antes, o servidor validaria a versão
      // anterior e acusaria como faltando o que já está preenchido na tela.
      if (!(await salvar())) return
      hidratar(await publicarEvento(id))
      setMsg({ kind: 'ok', text: 'Evento publicado. O link já abre.' })
    } catch (e) {
      if (e instanceof EventoIncompletoError) {
        setPendencias(e.missing)
        setMsg({ kind: 'err', text: 'Falta preencher isto para publicar:' })
      } else {
        setMsg({ kind: 'err', text: (e as Error).message })
      }
    } finally {
      setOcupado(false)
    }
  }

  async function aoDespublicar() {
    setMsg(null)
    setOcupado(true)
    try {
      hidratar(await despublicarEvento(id))
      setMsg({ kind: 'ok', text: 'Evento despublicado. O link deixou de abrir.' })
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setOcupado(false)
    }
  }

  if (carregando) {
    return <div className="flex justify-center py-24"><Spinner className="w-8 h-8" /></div>
  }

  if (erroDeCarga || !evento || !campos) {
    return (
      <div className="space-y-4">
        <PageHeader title="Evento" />
        <Alert kind="err">{erroDeCarga ?? 'Evento não encontrado.'}</Alert>
        <Button variant="secondary" onClick={() => navigate('/painel/eventos')}>Voltar para a lista</Button>
      </div>
    )
  }

  const publicado = evento.status === 'published'
  const podePublicar = hasPermission('evento:publish')

  return (
    <div className="space-y-6">
      <PageHeader
        title={campos.title || 'Evento sem nome'}
        subtitle="Preencha os dados e publique — o link fica pronto para compartilhar."
        actions={
          <>
            <Badge color={publicado ? 'green' : 'amber'}>
              <span className={`h-1.5 w-1.5 rounded-full ${publicado ? 'bg-green-500' : 'bg-amber-500'}`} />
              {publicado ? 'Publicado' : 'Rascunho'}
            </Badge>
            {publicado && evento.publicUrl && (
              <Button variant="secondary" onClick={() => window.open(evento.publicUrl!, '_blank')}>
                Ver página
              </Button>
            )}
            {!publicado && podePublicar && (
              <Button onClick={aoPublicar} disabled={ocupado || salvando}>
                {ocupado ? 'Publicando…' : 'Publicar'}
              </Button>
            )}
            <Button
              variant={publicado ? 'primary' : 'secondary'}
              onClick={aoSalvar}
              disabled={salvando || ocupado}
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </>
        }
      />

      {msg && <Alert message={msg} />}
      {pendencias.length > 0 && <ListaDePendencias pendencias={pendencias} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Cartao chave="sobre">
            <div className="space-y-4">
              <Field label="Título">
                <Input
                  value={campos.title}
                  maxLength={200}
                  onChange={e => alterar({ title: e.target.value })}
                />
              </Field>
              <Field label="Chamada">
                <Input
                  value={campos.summary}
                  maxLength={500}
                  placeholder="Uma frase sobre o evento."
                  onChange={e => alterar({ summary: e.target.value })}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Aparece embaixo do título, na capa e no preview do link.
                </p>
              </Field>
              <Field label="Departamento">
                <Select value={campos.category} onChange={e => alterar({ category: e.target.value })}>
                  <option value="">Sem departamento</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Descrição">
                <TextBlockEditor
                  doc={campos.description}
                  onChange={doc => alterar({ description: doc as TipTapDoc })}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Mesmo editor do boletim: títulos, listas, negrito e links.
                </p>
              </Field>
            </div>
          </Cartao>

          <Cartao chave="quando">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Início">
                <Input
                  type="datetime-local"
                  value={campos.inicio}
                  onChange={e => alterar({ inicio: e.target.value })}
                />
              </Field>
              <Field label="Término (opcional)">
                <Input
                  type="datetime-local"
                  value={campos.termino}
                  onChange={e => alterar({ termino: e.target.value })}
                />
              </Field>
              <Field label="Local">
                <Input
                  value={campos.locationName}
                  maxLength={200}
                  placeholder="Ex.: Salão principal — IASD Tucuruvi"
                  onChange={e => alterar({ locationName: e.target.value })}
                />
              </Field>
              <Field label="Endereço (opcional)">
                <Input
                  value={campos.locationAddress}
                  maxLength={300}
                  onChange={e => alterar({ locationAddress: e.target.value })}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Com endereço, a página do evento mostra o mapa de como chegar.
                </p>
              </Field>
            </div>
          </Cartao>

          <Cartao chave="responsavel">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome">
                <Input
                  value={campos.hostName}
                  maxLength={120}
                  onChange={e => alterar({ hostName: e.target.value })}
                />
              </Field>
              <Field label="Função">
                <Input
                  value={campos.hostRole}
                  maxLength={120}
                  placeholder="Ex.: Líder do Ministério Jovem"
                  onChange={e => alterar({ hostRole: e.target.value })}
                />
              </Field>
            </div>
            <div className="mt-5">
              <Field label="Foto">
                <FotoComRecorte
                  mediaId={campos.hostPhotoMediaId}
                  onChange={mediaId => alterar({ hostPhotoMediaId: mediaId })}
                />
              </Field>
            </div>
          </Cartao>
        </div>

        <div className="space-y-6">
          <Cartao chave="capa">
            <CapaEvento
              valores={campos}
              onChange={patch => alterar(patch)}
            />
          </Cartao>

          <Cartao chave="acao" opcional>
            <div className="space-y-4">
              <Field label="Texto">
                <Input
                  value={campos.ctaLabel}
                  maxLength={60}
                  placeholder="Ex.: Fazer inscrição"
                  onChange={e => alterar({ ctaLabel: e.target.value })}
                />
              </Field>
              <Field label="Link">
                <Input
                  value={campos.ctaUrl}
                  maxLength={500}
                  placeholder="https://…"
                  onChange={e => alterar({ ctaUrl: e.target.value })}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Formulário, grupo de WhatsApp, pagamento. Vazio esconde o botão.
                </p>
              </Field>
            </div>
          </Cartao>

          {publicado && evento.publicUrl && (
            <Card title="Compartilhar">
              <Compartilhar
                evento={evento}
                copiado={copiado}
                onCopiar={async () => {
                  try {
                    await navigator.clipboard.writeText(evento.publicUrl!)
                    setCopiado(true)
                    setTimeout(() => setCopiado(false), 2000)
                  } catch {
                    setMsg({ kind: 'err', text: 'Não foi possível copiar o link.' })
                  }
                }}
                onErro={texto => setMsg({ kind: 'err', text: texto })}
              />
              {podePublicar && (
                <div className="mt-4 border-t border-gray-200 pt-3">
                  <Button variant="ghost" size="sm" disabled={ocupado} onClick={aoDespublicar}>
                    Despublicar
                  </Button>
                  <p className="mt-1 text-xs text-gray-500">
                    Despublicado, o evento some de /eventos e o link deixa de abrir.
                  </p>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

/** Âncora de rolagem + o cartão: é para cá que a mensagem de pendência leva. */
function Cartao({
  chave, opcional, children,
}: {
  chave: CartaoDoEvento
  opcional?: boolean
  children: ReactNode
}) {
  return (
    <div id={idDoCartao(chave)} className="scroll-mt-6">
      <Card
        title={NOME_DO_CARTAO[chave]}
        actions={opcional ? <span className="text-xs font-normal text-gray-400">(opcional)</span> : undefined}
      >
        {children}
      </Card>
    </div>
  )
}

function idDoCartao(chave: CartaoDoEvento): string {
  return `cartao-${chave}`
}

function ListaDePendencias({ pendencias }: { pendencias: string[] }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <ul className="space-y-2">
        {pendencias.map(pendencia => {
          const cartao = cartaoDaPendencia(pendencia)
          return (
            <li key={pendencia} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{pendencia}</span>
              <button
                type="button"
                onClick={() => document.getElementById(idDoCartao(cartao))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="font-medium underline"
              >
                Ir para {NOME_DO_CARTAO[cartao]}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Compartilhar({
  evento, copiado, onCopiar, onErro,
}: {
  evento: Evento
  copiado: boolean
  onCopiar: () => void
  onErro: (texto: string) => void
}) {
  const [baixando, setBaixando] = useState(false)
  const texto = mensagemDeCompartilhamento(evento)

  async function arteParaStories() {
    setBaixando(true)
    try {
      const res = await fetch(`/eventos/${evento.slug}/story.png`)
      if (!res.ok) throw new Error('Não foi possível gerar a arte agora.')
      const blob = await res.blob()
      const arquivo = new File([blob], `${evento.slug}-stories.png`, { type: 'image/png' })
      // No celular, isso abre a lista de aplicativos e a arte chega no Instagram em um toque.
      // No computador não existe essa lista, então o caminho é baixar o arquivo.
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: evento.title, text: texto })
      } else {
        baixar(arquivo)
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') onErro((e as Error).message)
    } finally {
      setBaixando(false)
    }
  }

  return (
    <>
      <Field label="Link do evento">
        <div className="flex gap-2">
          <input
            readOnly
            value={evento.publicUrl ?? ''}
            className="w-full truncate rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700"
          />
          <Button
            variant="secondary"
            title={copiado ? 'Link copiado' : 'Copiar link'}
            aria-label={copiado ? 'Link copiado' : 'Copiar link'}
            icon={copiado ? ICONE_OK : ICONE_COPIAR}
            onClick={onCopiar}
          />
        </div>
      </Field>

      <div className="mt-4 space-y-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-iasd-dark px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-iasd-accent"
        >
          {ICONE_WHATSAPP}
          Enviar no WhatsApp
        </a>
        <Button variant="secondary" full disabled={baixando} icon={ICONE_STORIES} onClick={arteParaStories}>
          {baixando ? 'Preparando…' : 'Arte para Stories'}
        </Button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-gray-500">
        No celular, "Arte para Stories" abre a lista de aplicativos — dá para mandar direto para o
        Instagram ou o status do WhatsApp. No computador, baixa a imagem.
      </p>
    </>
  )
}

function baixar(arquivo: File) {
  const url = URL.createObjectURL(arquivo)
  const link = document.createElement('a')
  link.href = url
  link.download = arquivo.name
  link.click()
  URL.revokeObjectURL(url)
}
