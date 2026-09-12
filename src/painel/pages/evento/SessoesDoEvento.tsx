import { useEffect, useRef, useState } from 'react'
import { deCampoDeDataHora, novaSessaoDeFormulario, type SessaoDeFormulario } from '@/painel/eventos-api'
import { Button, Field, Input } from '@/painel/ui'

export type { SessaoDeFormulario }

/** Quanto tempo a faixa "Horário removido" espera por um "Desfazer" antes de sumir. */
const PRAZO_PARA_DESFAZER_MS = 8000

const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const CAMPO_COMPLETO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/**
 * O arranjo dos campos segue a largura do BLOCO, não a da janela: no painel o cartão divide a
 * tela com o menu lateral, e o seletor de data corta o valor abaixo de ~230px. Com gap-4 (16px),
 * dois campos de data pedem 476px e três colunas pedem 722px. As faixas são exclusivas para
 * que a ordem das regras geradas não decida qual grade vale. As classes vão escritas por
 * inteiro porque o Tailwind só gera o que encontra literalmente no código.
 */
const GRADE_DO_BLOCO = 'grid gap-4 [@container_(min-width:476px)_and_(max-width:721.98px)]:grid-cols-2 [@container_(min-width:722px)]:grid-cols-3'
const NOME_NA_GRADE = '[@container_(min-width:476px)_and_(max-width:721.98px)]:col-span-2'
const FRASE_NA_GRADE = '[@container_(min-width:476px)_and_(max-width:721.98px)]:col-span-2 [@container_(min-width:722px)]:col-span-3'

const ICONE_MAIS = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

interface Removido {
  item: SessaoDeFormulario
  /** Onde o bloco estava na lista quando saiu — é para lá que "Desfazer" o devolve. */
  posicao: number
}

/**
 * "sábado, 14 de março" e "09h30", lidos do que está digitado no campo — sem passar por fuso:
 * o campo já é o relógio da igreja, e o cabeçalho existe para conferir exatamente o que se digitou.
 */
function dataDoCampo(valor: string): { dia: string; hora: string } | null {
  const partes = CAMPO_COMPLETO.exec(valor)
  if (!partes) return null
  const [, ano, mes, dia, h, m] = partes
  const semana = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia))).getUTCDay()
  const nomeDoMes = MESES[Number(mes) - 1]
  if (!nomeDoMes) return null
  return { dia: `${DIAS_DA_SEMANA[semana]}, ${Number(dia)} de ${nomeDoMes}`, hora: `${h}h${m}` }
}

function comMaiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** O instante do início, ou null enquanto a data não estiver completa. */
function instanteDoInicio(s: SessaoDeFormulario): string | null {
  return CAMPO_COMPLETO.test(s.inicio) ? deCampoDeDataHora(s.inicio) : null
}

/** Ordem do relógio; o que ainda não tem data completa fica no fim, na ordem em que estava. */
function naOrdemDoRelogio(sessoes: SessaoDeFormulario[]): SessaoDeFormulario[] {
  return [...sessoes].sort((a, b) => {
    const ia = instanteDoInicio(a)
    const ib = instanteDoInicio(b)
    if (ia && ib) return ia.localeCompare(ib)
    if (ia) return -1
    if (ib) return 1
    return 0
  })
}

/**
 * Para cada bloco com horário repetido, a frase que aponta o outro bloco igual. Os dois lados do
 * conflito recebem a sua — é o que deixa a pessoa achar o par sem ler a lista inteira.
 */
export function horariosRepetidos(sessoes: SessaoDeFormulario[]): Map<string, string> {
  const porInstante = new Map<string, number[]>()
  sessoes.forEach((s, i) => {
    const instante = instanteDoInicio(s)
    if (!instante) return
    porInstante.set(instante, [...(porInstante.get(instante) ?? []), i])
  })
  const erros = new Map<string, string>()
  for (const posicoes of porInstante.values()) {
    if (posicoes.length < 2) continue
    for (const i of posicoes) {
      const outro = posicoes.find(p => p !== i)!
      erros.set(sessoes[i].chave, `Este horário já existe no ${outro + 1}º bloco.`)
    }
  }
  return erros
}

/** Blocos cujo início está vazio ou incompleto — não dá para gravar sem ele. */
export function semInicio(sessoes: SessaoDeFormulario[]): Set<string> {
  return new Set(sessoes.filter(s => !instanteDoInicio(s)).map(s => s.chave))
}

export default function SessoesDoEvento({
  sessoes, mostrarErros, onChange,
}: {
  sessoes: SessaoDeFormulario[]
  /** Liga as marcas de "Informe o início." — só depois de a pessoa tentar salvar. */
  mostrarErros: boolean
  onChange: (sessoes: SessaoDeFormulario[]) => void
}) {
  const [removidos, setRemovidos] = useState<Removido[]>([])
  const [focarChave, setFocarChave] = useState<string | null>(null)
  const camposDeInicio = useRef(new Map<string, HTMLInputElement>())
  const prazos = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    if (!focarChave) return
    camposDeInicio.current.get(focarChave)?.focus()
    setFocarChave(null)
  }, [focarChave])

  useEffect(() => {
    const pendentes = prazos.current
    return () => pendentes.forEach(prazo => clearTimeout(prazo))
  }, [])

  const repetidos = horariosRepetidos(sessoes)
  const vazios = mostrarErros ? semInicio(sessoes) : new Set<string>()

  function alterar(chave: string, patch: Partial<SessaoDeFormulario>) {
    onChange(sessoes.map(s => (s.chave === chave ? { ...s, ...patch } : s)))
  }

  function adicionar() {
    const nova = novaSessaoDeFormulario()
    onChange([...sessoes, nova])
    setFocarChave(nova.chave)
  }

  function remover(posicao: number) {
    const item = sessoes[posicao]
    onChange(sessoes.filter(s => s.chave !== item.chave))
    setRemovidos(atual => [...atual, { item, posicao }])
    prazos.current.set(item.chave, setTimeout(() => {
      prazos.current.delete(item.chave)
      setRemovidos(atual => atual.filter(r => r.item.chave !== item.chave))
    }, PRAZO_PARA_DESFAZER_MS))
  }

  function desfazer(removido: Removido) {
    clearTimeout(prazos.current.get(removido.item.chave))
    prazos.current.delete(removido.item.chave)
    setRemovidos(atual => atual.filter(r => r.item.chave !== removido.item.chave))
    const posicao = Math.min(removido.posicao, sessoes.length)
    onChange([...sessoes.slice(0, posicao), removido.item, ...sessoes.slice(posicao)])
  }

  function faixasEm(posicao: number, ateOFim = false) {
    return removidos
      .filter(r => (ateOFim ? r.posicao >= posicao : r.posicao === posicao))
      .map(r => (
        <li key={`removido-${r.item.chave}`}>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-4">
            <p className="text-sm text-gray-600">Horário removido</p>
            <Button type="button" variant="ghost" size="sm" className="underline" onClick={() => desfazer(r)}>
              Desfazer
            </Button>
          </div>
        </li>
      ))
  }

  return (
    <>
      <ol className="space-y-3">
        {sessoes.map((s, i) => {
          const data = dataDoCampo(s.inicio)
          const numero = i + 1
          const erroDoInicio = repetidos.get(s.chave) ?? (vazios.has(s.chave) ? 'Informe o início.' : undefined)
          const repetido = repetidos.has(s.chave)
          const id = `sessao-${s.chave}`
          return [
            ...faixasEm(i),
            <li key={s.chave}>
              <fieldset
                className={`rounded-lg bg-gray-50 p-4 ${repetido ? 'border-2 border-red-300' : 'border border-gray-200'}`}
              >
                <legend className="sr-only">
                  {`Horário ${numero} de ${sessoes.length}${data ? ` — ${data.dia}` : ''}`}
                </legend>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-heading text-sm font-bold text-iasd-dark" aria-hidden="true">
                    {data ? `${comMaiuscula(data.dia)} · ${data.hora}` : `Horário ${numero}`}
                  </p>
                  <Button type="button" variant="danger" size="md" onClick={() => remover(i)}>
                    Remover
                  </Button>
                </div>
                <div className="[container-type:inline-size]">
                  <div className={GRADE_DO_BLOCO}>
                    <Field label="Início" htmlFor={`${id}-inicio`} error={erroDoInicio}>
                      <Input
                        id={`${id}-inicio`}
                        ref={campo => {
                          if (campo) camposDeInicio.current.set(s.chave, campo)
                          else camposDeInicio.current.delete(s.chave)
                        }}
                        type="datetime-local"
                        value={s.inicio}
                        className={erroDoInicio ? 'border-red-300' : ''}
                        onChange={e => alterar(s.chave, { inicio: e.target.value })}
                        onBlur={() => onChange(naOrdemDoRelogio(sessoes))}
                      />
                    </Field>
                    <Field label="Término (opcional)" htmlFor={`${id}-termino`}>
                      <Input
                        id={`${id}-termino`}
                        type="datetime-local"
                        value={s.termino}
                        onChange={e => alterar(s.chave, { termino: e.target.value })}
                      />
                    </Field>
                    <div className={NOME_NA_GRADE}>
                      <Field label="Nome deste horário" htmlFor={`${id}-nome`}>
                        <Input
                          id={`${id}-nome`}
                          value={s.title}
                          maxLength={120}
                          onChange={e => alterar(s.chave, { title: e.target.value })}
                        />
                      </Field>
                    </div>
                    <div className={FRASE_NA_GRADE}>
                      <Field label="Uma frase sobre este horário" htmlFor={`${id}-frase`}>
                        <Input
                          id={`${id}-frase`}
                          value={s.description}
                          maxLength={500}
                          placeholder="Opcional."
                          onChange={e => alterar(s.chave, { description: e.target.value })}
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              </fieldset>
              {i === 0 && (
                <p className="mt-1.5 text-xs text-gray-500">Em branco, a programação mostra só o horário.</p>
              )}
            </li>,
          ]
        })}
        {faixasEm(sessoes.length, true)}
      </ol>

      <Button type="button" variant="secondary" full icon={ICONE_MAIS} className="mt-3" onClick={adicionar}>
        Adicionar horário
      </Button>
      <p className="mt-1.5 text-center text-xs text-gray-500">
        O horário novo entra no fim da lista e se acomoda na ordem do relógio depois que a data estiver completa.
      </p>
    </>
  )
}
