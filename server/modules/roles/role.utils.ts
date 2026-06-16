/** Gera uma chave (slug) a partir do nome: minúsculas, sem acento, não-alfanumérico → '-'. */
export function slugify(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'papel'
}
