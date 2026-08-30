export const COR_PADRAO_DESTAQUE = '#0055AA'
export const COR_PADRAO_SECUNDARIA = '#003366'
export const HEX = /^#[0-9a-fA-F]{6}$/

/**
 * Abaixo desta razão as duas cores são praticamente a mesma e a capa perde os contornos.
 * O par padrão da igreja fica em 1,73:1 e passa de propósito: no desenho o botão tem
 * contorno próprio, então ele sobrevive a esse contraste.
 */
const LIMITE_DE_AVISO = 1.5

const BRANCO = '#FFFFFF'
const QUASE_PRETO = '#0A0A0A'

/** Canal sRGB linearizado (WCAG 2.x). */
function canalLinear(valor: number): number {
  const c = valor / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Luminância relativa. Cor fora do formato #RRGGBB conta como preto. */
function luminancia(cor: string): number {
  if (!HEX.test(cor)) return 0
  const r = canalLinear(parseInt(cor.slice(1, 3), 16))
  const g = canalLinear(parseInt(cor.slice(3, 5), 16))
  const b = canalLinear(parseInt(cor.slice(5, 7), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Razão de contraste WCAG entre duas cores. 1 = idênticas, 21 = preto no branco. */
export function contraste(a: string, b: string): number {
  const la = luminancia(a)
  const lb = luminancia(b)
  const clara = Math.max(la, lb)
  const escura = Math.min(la, lb)
  return (clara + 0.05) / (escura + 0.05)
}

/** Branco ou quase-preto, o que for mais legível sobre o fundo dado. */
export function textoSobre(fundo: string): '#FFFFFF' | '#0A0A0A' {
  return contraste(fundo, BRANCO) >= contraste(fundo, QUASE_PRETO) ? BRANCO : QUASE_PRETO
}

/** Mensagem quando o destaque some na secundária. null = tudo bem, ou hexadecimal ainda incompleto. */
export function avisoDeContraste(destaque: string, secundaria: string): string | null {
  if (!HEX.test(destaque) || !HEX.test(secundaria)) return null
  if (contraste(destaque, secundaria) >= LIMITE_DE_AVISO) return null
  return 'As duas cores estão muito próximas: os detalhes e o botão vão quase sumir no fundo da capa.'
}
