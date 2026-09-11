import { useEffect, useState } from 'react'
import MediaPicker from '@/painel/components/MediaPicker'
import { Alert, Button, SegmentedControl } from '@/painel/ui'
import {
  COR_PADRAO_DESTAQUE, COR_PADRAO_SECUNDARIA, HEX, avisoDeContraste, textoSobre,
} from '@/lib/cores'
import { COVER_STYLES, type CoverMode, type CoverStyle } from '@/schemas/evento'

export interface ValoresDaCapa {
  coverMode: CoverMode
  coverStyle: CoverStyle
  accentColor: string
  secondaryColor: string
  artMediaId: string | null
}

interface Props {
  valores: ValoresDaCapa
  onChange: (patch: Partial<ValoresDaCapa>) => void
}

const NOME_DO_ESTILO: Record<CoverStyle, string> = {
  classico: 'Clássico',
  vibrante: 'Vibrante',
  sobrio: 'Sóbrio',
}

const MODOS = [
  { value: 'foto' as const, label: 'Montar com uma foto' },
  { value: 'arte' as const, label: 'Já tenho a arte' },
]

/**
 * Cartão "Capa": o modo (foto montada ou arte pronta), os três estilos e as duas cores do
 * evento. As miniaturas dos estilos usam as cores escolhidas, para a escolha ser vista sem
 * sair da tela. A cor do texto nunca é um campo: `textoSobre` decide pelo contraste.
 */
export default function CapaEvento({ valores, onChange }: Props) {
  const { coverMode, coverStyle, accentColor, secondaryColor, artMediaId } = valores
  const [escolhendoArte, setEscolhendoArte] = useState(false)
  const aviso = avisoDeContraste(accentColor, secondaryColor)
  const noPadrao = accentColor === COR_PADRAO_DESTAQUE && secondaryColor === COR_PADRAO_SECUNDARIA

  return (
    <div className="space-y-4">
      <SegmentedControl
        label="Como montar a capa"
        options={MODOS}
        value={coverMode}
        onChange={value => onChange({ coverMode: value })}
      />

      {coverMode === 'foto' ? (
        <div className="space-y-2">
          {COVER_STYLES.map(estilo => (
            <EscolhaDeEstilo
              key={estilo}
              estilo={estilo}
              selecionado={estilo === coverStyle}
              destaque={accentColor}
              secundaria={secondaryColor}
              onSelect={() => onChange({ coverStyle: estilo })}
            />
          ))}
          <p className="text-xs leading-relaxed text-gray-500">
            A foto do responsável, no cartão ao lado, é a que entra na capa.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-iasd-light p-3">
          {artMediaId ? (
            <>
              <img
                src={`/media/${artMediaId}`}
                alt="Arte do evento"
                className="mx-auto max-h-56 w-auto rounded-md border border-gray-300 bg-white"
              />
              <div className="mt-3 flex justify-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEscolhendoArte(true)}>
                  Trocar
                </Button>
                <Button variant="danger" size="sm" onClick={() => onChange({ artMediaId: null })}>
                  Remover
                </Button>
              </div>
            </>
          ) : (
            <div className="py-4 text-center">
              <p className="text-sm text-gray-600">Nenhuma arte enviada.</p>
              <Button className="mt-3" variant="secondary" size="sm" onClick={() => setEscolhendoArte(true)}>
                Escolher a arte
              </Button>
            </div>
          )}
          <p className="mt-3 text-xs leading-relaxed text-gray-500">
            Qualquer proporção serve. A arte nunca é cortada — o site se ajusta a ela.
          </p>
        </div>
      )}

      <div className="border-t border-gray-200 pt-4">
        <p className="mb-2 text-sm text-gray-600">Cores do evento</p>
        <div className="space-y-2">
          <CampoDeCor
            rotulo="Destaque"
            valor={accentColor}
            onChange={cor => onChange({ accentColor: cor })}
          />
          <CampoDeCor
            rotulo="Secundária"
            valor={secondaryColor}
            onChange={cor => onChange({ secondaryColor: cor })}
          />
        </div>
        <Button
          className="mt-2"
          variant="ghost"
          size="sm"
          disabled={noPadrao}
          onClick={() => onChange({
            accentColor: COR_PADRAO_DESTAQUE,
            secondaryColor: COR_PADRAO_SECUNDARIA,
          })}
        >
          Voltar ao padrão da igreja
        </Button>
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          A cor do texto não é escolhida: o sistema usa clara ou escura, conforme o fundo.
        </p>
        {aviso && <div className="mt-3"><Alert kind="warn">{aviso} Dá para publicar assim mesmo.</Alert></div>}
      </div>

      <MediaPicker
        open={escolhendoArte}
        onClose={() => setEscolhendoArte(false)}
        onSelect={id => onChange({ artMediaId: id })}
      />
    </div>
  )
}

/** Seletor nativo do navegador + o hexadecimal ao lado, editável. */
function CampoDeCor({
  rotulo, valor, onChange,
}: {
  rotulo: string
  valor: string
  onChange: (cor: string) => void
}) {
  const [texto, setTexto] = useState(valor)
  const id = `cor-${rotulo.toLowerCase()}`

  // A cor também muda por fora do campo (botão de voltar ao padrão, evento recarregado).
  useEffect(() => setTexto(valor), [valor])

  function digitou(bruto: string) {
    const proximo = bruto.toUpperCase()
    setTexto(proximo)
    if (HEX.test(proximo)) onChange(proximo)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={`${rotulo}: escolher no seletor de cores`}
        value={valor}
        onChange={e => onChange(e.target.value.toUpperCase())}
        className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-gray-300 bg-white p-0.5"
      />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="text-xs text-gray-500">{rotulo}</label>
        <input
          id={id}
          value={texto}
          maxLength={7}
          spellCheck={false}
          onChange={e => digitou(e.target.value)}
          onBlur={() => setTexto(valor)}
          className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm uppercase focus:border-iasd-accent focus:outline-none focus:ring-2 focus:ring-iasd-accent/40"
        />
      </div>
    </div>
  )
}

function EscolhaDeEstilo({
  estilo, selecionado, destaque, secundaria, onSelect,
}: {
  estilo: CoverStyle
  selecionado: boolean
  destaque: string
  secundaria: string
  onSelect: () => void
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-2 transition-colors ${
        selecionado ? 'border-iasd-accent bg-iasd-light' : 'border-transparent hover:bg-gray-50'
      }`}
    >
      <input
        type="radio"
        name="estilo-da-capa"
        className="sr-only"
        checked={selecionado}
        onChange={onSelect}
      />
      <Miniatura estilo={estilo} destaque={destaque} secundaria={secundaria} />
      <span className={`text-sm font-medium ${selecionado ? 'text-iasd-dark' : 'text-gray-700'}`}>
        {NOME_DO_ESTILO[estilo]}
      </span>
      {selecionado && (
        <svg viewBox="0 0 24 24" className="ml-auto h-4 w-4 text-iasd-accent" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </label>
  )
}

/**
 * O arranjo de cada estilo em 80×48, pintado com as cores escolhidas. As cores entram como
 * estilo em linha, nunca como classe do Tailwind: a classe é varrida em tempo de build e não
 * existiria para um valor vindo do banco.
 */
function Miniatura({ estilo, destaque, secundaria }: { estilo: CoverStyle; destaque: string; secundaria: string }) {
  const base = 'h-12 w-20 shrink-0 overflow-hidden rounded'

  if (estilo === 'classico') {
    const texto = textoSobre(secundaria)
    return (
      <span className={base} style={{ background: secundaria }} aria-hidden="true">
        <span className="flex h-full items-center gap-1 p-1.5">
          <span className="flex-1 space-y-1">
            <span className="block h-1.5 w-full rounded-sm" style={{ background: texto }} />
            <span className="block h-1 w-2/3 rounded-sm" style={{ background: destaque }} />
          </span>
          <Silhueta className="h-full w-5" />
        </span>
      </span>
    )
  }

  if (estilo === 'vibrante') {
    return (
      <span
        className={base}
        style={{ background: `linear-gradient(135deg, ${destaque}, ${secundaria})` }}
        aria-hidden="true"
      >
        <span className="flex h-full flex-col items-center justify-end pb-1">
          <Silhueta className="h-7 w-5" />
          <span className="block h-1.5 w-12 rounded-sm" style={{ background: textoSobre(secundaria) }} />
        </span>
      </span>
    )
  }

  return (
    <span className={`${base} border border-gray-200 bg-white`} aria-hidden="true">
      <span className="block h-1 w-full" style={{ background: destaque }} />
      <span className="flex h-[calc(100%-0.25rem)] items-center gap-1 p-1.5">
        <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-iasd-light">
          <Silhueta className="h-full w-full" />
        </span>
        <span className="flex-1 space-y-1">
          <span className="block h-1.5 w-full rounded-sm" style={{ background: secundaria }} />
          <span className="block h-1 w-2/3 rounded-sm bg-gray-300" />
        </span>
      </span>
    </span>
  )
}

/** O retrato de quem conduz o evento, do jeito que ele entra na capa. */
function Silhueta({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 200 240" className={className} aria-hidden="true">
      <path d="M28 240c0-45 30-70 72-70s72 25 72 70Z" fill="#1f4d7a" />
      <path d="M84 146h32v32H84z" fill="#d79b70" />
      <ellipse cx="100" cy="106" rx="41" ry="47" fill="#eab991" />
      <path d="M59 104c0-33 19-49 41-49s41 16 41 49c0-14-11-20-23-22-11-2-31-2-42 2-11 4-17 8-17 20Z" fill="#3a2b23" />
    </svg>
  )
}
