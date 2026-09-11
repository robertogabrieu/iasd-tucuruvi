import { z } from 'zod'
import { paginationQuery } from '../../../core/pagination.js'

/** Query da listagem: paginação padrão + busca opcional por nome. */
export const listMediaQuery = paginationQuery.extend({
  q: z.string().trim().min(1).max(120).optional(),
})
export type ListMediaQuery = z.infer<typeof listMediaQuery>
