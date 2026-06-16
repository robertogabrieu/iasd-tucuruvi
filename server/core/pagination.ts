import { z } from 'zod'

/** Contrato padrão de paginação de listagens (CLAUDE.md › Convenções de código). */
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type PaginationParams = z.infer<typeof paginationQuery>

export interface Paginated<T> {
  data: T[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

/** Deslocamento SQL a partir de page/limit (1-based). */
export function toOffset(p: { page: number; limit: number }): number {
  return (p.page - 1) * p.limit
}

/** Monta o envelope padrão `{ data, pagination }`. */
export function paginate<T>(data: T[], total: number, p: { page: number; limit: number }): Paginated<T> {
  return {
    data,
    pagination: { page: p.page, limit: p.limit, total, totalPages: Math.max(1, Math.ceil(total / p.limit)) },
  }
}
