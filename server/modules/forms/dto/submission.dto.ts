import { z } from 'zod'
import { paginationQuery } from '../../../core/pagination.js'
import type { FormDefinition } from './form-definition.js'

export const submissionListQuery = paginationQuery.extend({
  q: z.string().max(200).optional(),
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})
export type SubmissionListQuery = z.infer<typeof submissionListQuery>

/** Exportação não pagina: usa os mesmos filtros da tela, sem page/limit. */
export const submissionExportQuery = submissionListQuery.omit({ page: true, limit: true })

export interface FieldFilter { key: string; value: string }

/**
 * Lê os `f_<chave>` da query e confere cada um contra a definição. Chave desconhecida ou valor
 * fora das opções vira erro — nada daqui chega ao SQL sem passar pela definição.
 */
export function parseFieldFilters(
  query: Record<string, unknown>,
  def: FormDefinition,
): { filters: FieldFilter[]; error?: string } {
  const filters: FieldFilter[] = []
  for (const [name, raw] of Object.entries(query)) {
    if (!name.startsWith('f_')) continue
    const key = name.slice(2)
    const field = def.fields.find(f => f.key === key)
    if (!field || field.type !== 'choice') return { filters: [], error: `Filtro desconhecido: ${key}.` }
    const value = String(raw)
    if (value === '') continue
    if (!field.options?.includes(value)) return { filters: [], error: `Valor inválido para ${field.label}.` }
    filters.push({ key, value })
  }
  return { filters }
}
