// Espelho client dos schemas Zod do evento.
// FONTE DA VERDADE: server/modules/eventos/dto/evento.dto.ts — manter em sincronia.
// (Convenção do projeto: schemas Zod duplicados client/server, como em contato e boletim.)

import { z } from 'zod'
import { COR_PADRAO_DESTAQUE, COR_PADRAO_SECUNDARIA, HEX } from '@/lib/cores'

export const COVER_MODES = ['foto', 'arte'] as const
export const COVER_STYLES = ['classico', 'vibrante', 'sobrio'] as const

/** Lista fechada em código, não tabela: vira tabela no dia em que alguém criar categoria pela tela. */
export const CATEGORIES = [
  'Culto especial', 'Jovens', 'Desbravadores', 'Aventureiros',
  'Música', 'Mulheres', 'Comunicação', 'Outro',
] as const

/** Documento TipTap/ProseMirror serializado, o mesmo formato do bloco de texto do boletim. */
export const tipTapDocSchema = z.object({ type: z.literal('doc'), content: z.array(z.unknown()).optional() })
export type TipTapDoc = z.infer<typeof tipTapDocSchema>

export type CoverMode = (typeof COVER_MODES)[number]
export type CoverStyle = (typeof COVER_STYLES)[number]
export type Category = (typeof CATEGORIES)[number]

const cor = z.string().regex(HEX, 'Use uma cor no formato #RRGGBB.')
const linkExterno = z.string().trim().max(500).regex(/^https?:\/\/\S+$/i, 'O link precisa começar com http:// ou https://.')

/** Campos comuns a criar e editar. O que é obrigatório para PUBLICAR fica no servidor. */
const camposDoEvento = {
  title: z.string().trim().min(1, 'Título é obrigatório.').max(200),
  summary: z.string().trim().max(500).nullable(),
  description: tipTapDocSchema,
  category: z.enum(CATEGORIES).nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable(),
  locationName: z.string().trim().max(200),
  locationAddress: z.string().trim().max(300).nullable(),
  coverMode: z.enum(COVER_MODES),
  coverStyle: z.enum(COVER_STYLES),
  accentColor: cor,
  secondaryColor: cor,
  hostName: z.string().trim().max(120).nullable(),
  hostRole: z.string().trim().max(120).nullable(),
  hostPhotoMediaId: z.string().uuid().nullable(),
  artMediaId: z.string().uuid().nullable(),
  ctaLabel: z.string().trim().max(60).nullable(),
  ctaUrl: linkExterno.nullable(),
}

/** Só o título é exigido para criar: rascunho pode nascer pela metade (spec §3.2). */
export const createEventoSchema = z.object(camposDoEvento).partial().extend({
  title: camposDoEvento.title,
  accentColor: camposDoEvento.accentColor.default(COR_PADRAO_DESTAQUE),
  secondaryColor: camposDoEvento.secondaryColor.default(COR_PADRAO_SECUNDARIA),
})
export type CreateEventoDto = z.infer<typeof createEventoSchema>

export const updateEventoSchema = z.object(camposDoEvento).partial()
export type UpdateEventoDto = z.infer<typeof updateEventoSchema>

/** O que a API devolve. Datas vêm serializadas em ISO 8601, não como Date. */
export interface EventoDTO {
  id: string
  title: string
  summary: string | null
  description: TipTapDoc
  category: string | null
  startsAt: string
  endsAt: string | null
  locationName: string
  locationAddress: string | null
  coverMode: CoverMode
  coverStyle: CoverStyle
  accentColor: string
  secondaryColor: string
  hostName: string | null
  hostRole: string | null
  hostPhotoMediaId: string | null
  artMediaId: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  status: 'draft' | 'published'
  slug: string | null
  publicUrl: string | null
  publishedAt: string | null
}
