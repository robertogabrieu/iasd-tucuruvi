/**
 * Título da aba de cada página pública. O Analytics nomeia as páginas pelo título da aba, e
 * o site troca de página sem recarregar: sem atualizar o título, todo acesso apareceria nos
 * relatórios com o nome da primeira página aberta.
 *
 * ESPELHO: server/lib/seo.ts (PAGINAS_PUBLICAS), que põe o mesmo título no HTML inicial
 * para os buscadores; o teste de seo confere que os dois batem.
 */
export const TITULOS_DAS_PAGINAS: Record<string, string> = {
  '/': 'Igreja Adventista do Sétimo Dia — Tucuruvi | Parada Inglesa, São Paulo',
  '/sermoes': 'Sermões | IASD Tucuruvi',
  '/galeria': 'Galeria de fotos | IASD Tucuruvi',
  '/eventos': 'Eventos | IASD Tucuruvi',
  '/asa': 'Ação Solidária Adventista (ASA) | IASD Tucuruvi',
  '/vida-e-saude': 'Clube Vida e Saúde | IASD Tucuruvi',
  '/desbravadores': 'Clube de Desbravadores Antares | IASD Tucuruvi',
  '/desbravadores/especialidades': 'Especialidades dos Desbravadores | Clube Antares',
  '/aventureiros': 'Clube de Aventureiros Antares Kids | IASD Tucuruvi',
}

export function tituloDaPagina(pathname: string): string {
  const alvo = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return TITULOS_DAS_PAGINAS[alvo] ?? TITULOS_DAS_PAGINAS['/']
}
