import type { MediaUsageChecker } from '../media/media.service.js'
import type { BoletinsRepository } from './boletins.repository.js'

/** Bloqueia exclusão de imagem usada como capa ou dentro de algum boletim. */
export function makeBoletinMediaUsageChecker(repo: BoletinsRepository): MediaUsageChecker {
  return (mediaId: string) => repo.mediaInUse(mediaId)
}
