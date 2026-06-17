// server/modules/boletins/boletins.slug.ts
/** Gera um slug legível e seguro para URL a partir de um título (sem acentos/especiais). */
export function slugify(title: string): string {
  const base = title
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // não-alfanumérico → hífen
    .replace(/^-+|-+$/g, '')     // tira hífens das pontas
    .slice(0, 80)
  return base || 'boletim'
}
