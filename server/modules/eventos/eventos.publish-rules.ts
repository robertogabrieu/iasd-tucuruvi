import type { EventoDTO, TipTapDoc } from './dto/evento.dto.js'

/** Nós que carregam conteúdo próprio mesmo sem texto (imagem, vídeo, divisória…). */
const NOS_SEM_TEXTO = new Set(['image', 'video', 'horizontalRule', 'table'])

/** Um documento do TipTap com só parágrafos vazios continua sendo "não escreveu nada". */
function descricaoVazia(doc: TipTapDoc | null | undefined): boolean {
  if (!doc) return true
  let temConteudo = false
  const visitar = (no: unknown): void => {
    if (temConteudo || !no || typeof no !== 'object') return
    const { type, text, content } = no as { type?: string; text?: string; content?: unknown[] }
    if (typeof text === 'string' && text.trim()) { temConteudo = true; return }
    if (type && NOS_SEM_TEXTO.has(type)) { temConteudo = true; return }
    if (Array.isArray(content)) content.forEach(visitar)
  }
  visitar(doc)
  return !temConteudo
}

function vazio(valor: string | null | undefined): boolean {
  return !valor || !valor.trim()
}

/** Devolve as mensagens do que impede publicar. Vazio = pode publicar. */
export function faltaParaPublicar(e: EventoDTO): string[] {
  const falta: string[] = []

  if (vazio(e.title)) falta.push('Dê um nome ao evento.')
  if (descricaoVazia(e.description)) falta.push('Escreva a descrição do evento.')
  if (vazio(e.startsAt)) falta.push('Informe a data e a hora de início.')
  if (vazio(e.locationName)) falta.push('Informe onde o evento acontece.')

  if (e.startsAt && e.endsAt && new Date(e.endsAt) <= new Date(e.startsAt)) {
    falta.push('O término precisa ser depois do início.')
  }

  if (e.coverMode === 'foto') {
    if (vazio(e.hostPhotoMediaId)) falta.push('Escolha a foto do responsável para a capa.')
    if (vazio(e.hostName)) falta.push('Informe o nome de quem conduz o evento.')
    if (vazio(e.hostRole)) falta.push('Informe a função de quem conduz o evento.')
  }
  if (e.coverMode === 'arte' && vazio(e.artMediaId)) {
    falta.push('Envie a arte que vai virar a capa.')
  }

  if (vazio(e.ctaLabel) !== vazio(e.ctaUrl)) {
    falta.push('O botão de ação precisa do texto e do link — preencha os dois ou apague os dois.')
  }

  return falta
}
