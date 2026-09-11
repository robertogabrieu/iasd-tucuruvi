import type { CSSProperties, ReactNode } from 'react'
import { contraste, textoSobre } from '@/lib/cores'
import type { CoverStyle, EventoDTO } from '@/schemas/evento'

/** Fundo claro do estilo sóbrio: fixo por definição (spec §3.1), não sai das cores do evento. */
const FUNDO_CLARO = '#F7F8FA'
const BRANCO = '#FFFFFF'
const QUASE_PRETO = '#0A0A0A'

/** Abaixo disto um texto colorido deixa de ser lido; é o mínimo do WCAG AA para texto normal. */
const CONTRASTE_MINIMO_DE_TEXTO = 4.5

const FUSO = 'America/Sao_Paulo'

/**
 * Regra 1 da trava de contraste (spec §3.1): a cor do texto nunca é escolhida por quem publica.
 * A cor pedida só vale se for legível sobre o fundo; senão cai para branco ou quase-preto.
 * Mesma conta de `server/modules/eventos/eventos.image.styles.ts`, para a capa da página e a
 * imagem do link do WhatsApp saírem com a mesma paleta.
 */
function corLegivel(desejada: string, fundo: string): string {
  return contraste(desejada, fundo) >= CONTRASTE_MINIMO_DE_TEXTO ? desejada : textoSobre(fundo)
}

/** Cor de texto que sobrevive às duas pontas de um gradiente, e não só à média entre elas. */
function textoSobreDuasCores(a: string, b: string): string {
  const claro = Math.min(contraste(a, BRANCO), contraste(b, BRANCO))
  const escuro = Math.min(contraste(a, QUASE_PRETO), contraste(b, QUASE_PRETO))
  return claro >= escuro ? BRANCO : QUASE_PRETO
}

type Arranjo = 'imagem-a-direita' | 'imagem-em-cima' | 'imagem-a-esquerda'

interface Aparencia {
  fundo: string
  /** Gradiente sobreposto ao fundo chapado; null nos estilos de cor sólida. */
  gradiente: string | null
  /** Faixa fina do destaque no topo (estilo sóbrio). */
  faixaNoTopo: boolean
  texto: string
  olho: string
  titulo: string
  botao: { fundo: string; borda: string; rotulo: string }
  arranjo: Arranjo
  retratoRedondo: boolean
}

function aparenciaDo(estilo: CoverStyle, destaque: string, secundaria: string): Aparencia {
  if (estilo === 'vibrante') {
    const texto = textoSobreDuasCores(destaque, secundaria)
    return {
      fundo: secundaria,
      gradiente: `linear-gradient(140deg, ${destaque} 0%, ${secundaria} 100%)`,
      faixaNoTopo: false,
      texto,
      olho: texto,
      titulo: texto,
      botao: { fundo: texto, borda: texto, rotulo: textoSobre(texto) },
      arranjo: 'imagem-em-cima',
      retratoRedondo: false,
    }
  }

  if (estilo === 'sobrio') {
    const texto = textoSobre(FUNDO_CLARO)
    const contornado = corLegivel(destaque, FUNDO_CLARO)
    return {
      fundo: FUNDO_CLARO,
      gradiente: null,
      faixaNoTopo: true,
      texto,
      olho: contornado,
      titulo: corLegivel(secundaria, FUNDO_CLARO),
      botao: { fundo: 'transparent', borda: contornado, rotulo: contornado },
      arranjo: 'imagem-a-esquerda',
      retratoRedondo: true,
    }
  }

  const texto = textoSobre(secundaria)
  return {
    fundo: secundaria,
    gradiente: null,
    faixaNoTopo: false,
    texto,
    olho: corLegivel(destaque, secundaria),
    titulo: texto,
    botao: { fundo: destaque, borda: destaque, rotulo: textoSobre(destaque) },
    arranjo: 'imagem-a-direita',
    retratoRedondo: false,
  }
}

function formatador(opcoes: Intl.DateTimeFormatOptions, locale = 'pt-BR'): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, { timeZone: FUSO, ...opcoes })
}

/** "Sábado, 26 de setembro" — o dia como a igreja o anuncia. */
function diaPorExtenso(iso: string): string {
  const texto = formatador({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso))
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** "19h30" — o relógio da igreja, não o de quem abre a página. */
function hora(iso: string): string {
  return formatador({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)).replace(':', 'h')
}

/** O dia do calendário em São Paulo, para saber se o evento atravessa a meia-noite. */
function diaCivil(iso: string): string {
  return formatador({ year: 'numeric', month: '2-digit', day: '2-digit' }, 'sv-SE').format(new Date(iso))
}

/** "19h30 às 22h00", e com o dia junto quando a vigília vira a noite. */
function faixaDeHorario(startsAt: string, endsAt: string | null): string {
  if (!endsAt) return hora(startsAt)
  const fim = diaCivil(endsAt) === diaCivil(startsAt)
    ? hora(endsAt)
    : `${formatador({ day: '2-digit', month: '2-digit' }).format(new Date(endsAt))}, ${hora(endsAt)}`
  return `${hora(startsAt)} às ${fim}`
}

/**
 * A capa da página do evento: um só arranjo com três paletas, nos dois modos de capa.
 *
 * As duas cores do evento entram como variáveis CSS em linha no elemento raiz
 * (`--evento-destaque`, `--evento-secundaria`, `--evento-texto`) e as classes as consomem —
 * nome de classe do Tailwind montado com valor vindo do banco não existiria, porque o Tailwind
 * varre o código em tempo de build. As cores param aqui e no corpo da página: o cabeçalho e o
 * rodapé do site continuam na cor da igreja.
 */
export default function EventoHero({ evento }: { evento: EventoDTO }) {
  const a = aparenciaDo(evento.coverStyle, evento.accentColor, evento.secondaryColor)
  const arte = evento.coverMode === 'arte' && evento.artMediaId ? `/media/${evento.artMediaId}` : null
  const retrato = evento.coverMode === 'foto' && evento.hostPhotoMediaId
    ? `/media/${evento.hostPhotoMediaId}`
    : null

  const vars = {
    '--evento-destaque': evento.accentColor,
    '--evento-secundaria': evento.secondaryColor,
    '--evento-texto': a.texto,
    '--evento-olho': a.olho,
    '--evento-titulo': a.titulo,
    '--evento-fundo': a.fundo,
    '--evento-gradiente': a.gradiente ?? 'none',
    '--evento-botao-fundo': a.botao.fundo,
    '--evento-botao-borda': a.botao.borda,
    '--evento-botao-texto': a.botao.rotulo,
  } as CSSProperties

  // A arte pronta entra inteira, e o arranjo do estilo cede: cartaz à esquerda, texto à direita.
  const arranjo = arte ? 'imagem-a-esquerda' : a.arranjo
  const centralizado = arranjo === 'imagem-em-cima'

  // Quando a cor de destaque não é legível sobre o fundo, o olho e os rótulos caem na cor do
  // texto — e sem um peso menor eles ficariam iguais ao título.
  const olhoSemCorPropria = a.olho === a.texto ? 'opacity-75' : ''

  const grade = {
    'imagem-a-direita': 'md:grid-cols-[1fr_auto]',
    'imagem-a-esquerda': 'md:grid-cols-[auto_1fr]',
    'imagem-em-cima': 'justify-items-center',
  }[arranjo]

  const imagem = arte
    ? <ArteInteira src={arte} titulo={evento.title} />
    : retrato
      ? <Retrato src={retrato} nome={evento.hostName} papel={evento.hostRole} redondo={a.retratoRedondo} />
      : null

  return (
    <section className="relative overflow-hidden bg-[var(--evento-fundo)]" style={vars}>
      {arte && (
        <img
          src={arte}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-30 blur-3xl"
        />
      )}
      {a.gradiente && <div className="absolute inset-0 bg-[image:var(--evento-gradiente)]" aria-hidden="true" />}
      <div className="evento-hero-tex absolute inset-0 opacity-10" aria-hidden="true" />
      {a.faixaNoTopo && <div className="absolute inset-x-0 top-0 h-1.5 bg-[var(--evento-destaque)]" aria-hidden="true" />}

      <div className={`relative mx-auto grid max-w-5xl items-center gap-8 px-4 py-12 md:py-16 ${grade}`}>
        {arranjo !== 'imagem-a-direita' && imagem}

        <div className={centralizado ? 'text-center' : ''}>
          {evento.category && (
            <p className={`font-heading text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--evento-olho)] ${olhoSemCorPropria}`}>
              {evento.category}
            </p>
          )}
          <h1
            className="mt-3 font-heading text-3xl font-bold leading-tight text-[color:var(--evento-titulo)] md:text-5xl"
            style={{ textWrap: 'balance' } as CSSProperties}
          >
            {evento.title}
          </h1>
          {evento.summary && (
            <p className={`mt-4 text-lg text-[color:var(--evento-texto)] opacity-80 ${centralizado ? 'mx-auto' : ''} max-w-xl`}>
              {evento.summary}
            </p>
          )}

          <dl className={`mt-8 flex flex-wrap gap-x-10 gap-y-4 ${centralizado ? 'justify-center' : ''}`}>
            <Bloco rotulo="Quando" classeDoRotulo={olhoSemCorPropria}>
              <dd className="mt-1 font-heading text-base font-bold text-[color:var(--evento-texto)]">
                {diaPorExtenso(evento.startsAt)}
              </dd>
              <dd className="text-sm text-[color:var(--evento-texto)] opacity-80">
                {faixaDeHorario(evento.startsAt, evento.endsAt)}
              </dd>
            </Bloco>
            {evento.locationName && (
              <Bloco rotulo="Onde" classeDoRotulo={olhoSemCorPropria}>
                <dd className="mt-1 font-heading text-base font-bold text-[color:var(--evento-texto)]">
                  {evento.locationName}
                </dd>
                {evento.locationAddress && (
                  <dd className="text-sm text-[color:var(--evento-texto)] opacity-80">{evento.locationAddress}</dd>
                )}
              </Bloco>
            )}
          </dl>

          {evento.ctaLabel && evento.ctaUrl && (
            <a
              href={evento.ctaUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-block rounded-full border-2 border-[color:var(--evento-botao-borda)] bg-[var(--evento-botao-fundo)] px-8 py-3 font-heading font-bold text-[color:var(--evento-botao-texto)] transition-transform hover:scale-105"
            >
              {evento.ctaLabel}
            </a>
          )}
        </div>

        {arranjo === 'imagem-a-direita' && imagem}
      </div>
    </section>
  )
}

function Bloco({
  rotulo, classeDoRotulo, children,
}: {
  rotulo: string
  classeDoRotulo: string
  children: ReactNode
}) {
  return (
    <div>
      <dt className={`text-xs uppercase tracking-wider text-[color:var(--evento-olho)] ${classeDoRotulo}`}>
        {rotulo}
      </dt>
      {children}
    </div>
  )
}

/** O cartaz pronto: inteiro, na proporção em que foi feito — nunca cortado (spec §3.2). */
function ArteInteira({ src, titulo }: { src: string; titulo: string }) {
  return (
    <img
      src={src}
      alt={`Arte do evento ${titulo}`}
      className="mx-auto max-h-[24rem] w-auto max-w-full rounded-xl shadow-2xl ring-1 ring-white/20"
    />
  )
}

/** O retrato de quem conduz o evento, recortado no painel. Em círculo só no estilo sóbrio. */
function Retrato({
  src, nome, papel, redondo,
}: {
  src: string
  nome: string | null
  papel: string | null
  redondo: boolean
}) {
  return (
    <figure className="mx-auto w-44 md:w-56">
      <img
        src={src}
        alt={nome ?? 'Responsável pelo evento'}
        className={
          redondo
            ? 'mx-auto h-36 w-36 rounded-full object-cover shadow-lg ring-4 ring-white md:h-44 md:w-44'
            : 'w-full drop-shadow-2xl'
        }
      />
      {(nome || papel) && (
        <figcaption className="mt-3 text-center">
          {nome && <p className="font-heading text-sm font-bold text-[color:var(--evento-texto)]">{nome}</p>}
          {papel && <p className="text-xs text-[color:var(--evento-olho)]">{papel}</p>}
        </figcaption>
      )}
    </figure>
  )
}
