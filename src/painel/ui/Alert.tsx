import type { ReactNode } from 'react'

export type Message = { kind: 'ok' | 'err'; text: string }

/** Faixa de mensagem de sucesso/erro. Aceita `kind`+`children` ou um objeto `message`. */
export default function Alert({ kind, message, children }: { kind?: 'ok' | 'err'; message?: Message | null; children?: ReactNode }) {
  const k = message?.kind ?? kind ?? 'ok'
  const content = message?.text ?? children
  if (!content) return null
  return (
    <div className={`rounded-lg px-4 py-2.5 text-sm border ${k === 'ok'
      ? 'bg-green-50 text-green-800 border-green-200'
      : 'bg-red-50 text-red-700 border-red-200'}`}>{content}</div>
  )
}
