import type { MediaUsageChecker } from '../media/media.service.js'
import type { EventosRepository } from './eventos.repository.js'

/** Bloqueia exclusão de imagem usada como foto do responsável ou como arte de algum evento. */
export function makeEventoMediaUsageChecker(repo: EventosRepository): MediaUsageChecker {
  return (mediaId: string) => repo.mediaInUse(mediaId)
}
