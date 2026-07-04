import { z } from 'zod'
import { paginationQuery } from '../../../core/pagination.js'
import { contentSchema } from './block.schema.js'

export const createBoletimDto = z.object({
  title: z.string().trim().min(1, 'Título é obrigatório.').max(200),
  templateId: z.string().uuid().optional(),
})
export type CreateBoletimDto = z.infer<typeof createBoletimDto>

export const updateBoletimDto = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().max(500).nullable().optional(),
  coverMediaId: z.string().uuid().nullable().optional(),
  content: contentSchema.optional(),
})
export type UpdateBoletimDto = z.infer<typeof updateBoletimDto>

export const listBoletinsQuery = paginationQuery.extend({
  status: z.enum(['draft', 'published']).optional(),
})
export type ListBoletinsQuery = z.infer<typeof listBoletinsQuery>
