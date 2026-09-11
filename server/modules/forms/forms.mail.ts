import type { FormDefinition } from './dto/form-definition.js'
import type { SubmissionRow } from './dto/submission-row.js'

/**
 * Corpo do aviso, montado a partir da definição: serve qualquer formulário sem alteração.
 * Texto simples de propósito — o destino é a caixa de quem vai ligar de volta.
 */
export function buildNotifyBody(def: FormDefinition, row: SubmissionRow): string {
  const quando = row.created_at.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const linhas = def.fields.map(f => `${f.label}: ${row.data[f.key] || '—'}`)
  return [
    `Nova submissão do formulário "${def.label}".`,
    '',
    ...linhas,
    '',
    `Recebido em ${quando}.`,
  ].join('\n')
}
