import type { ReactNode } from 'react'

export type Message = { kind: Kind; text: string }

/** `warn` é aviso que não bloqueia: o âmbar do guia visual. */
type Kind = 'ok' | 'err' | 'warn'

const estilos: Record<Kind, string> = {
  ok: 'bg-green-50 text-green-800 border-green-200',
  err: 'bg-red-50 text-red-700 border-red-200',
  warn: 'bg-amber-50 text-amber-800 border-amber-200',
}

/** Faixa de mensagem de sucesso, erro ou aviso. Aceita `kind`+`children` ou um objeto `message`. */
export default function Alert({ kind, message, children }: { kind?: Kind; message?: Message | null; children?: ReactNode }) {
  const k = message?.kind ?? kind ?? 'ok'
  const content = message?.text ?? children
  if (!content) return null
  return <div className={`rounded-lg px-4 py-2.5 text-sm border ${estilos[k]}`}>{content}</div>
}
