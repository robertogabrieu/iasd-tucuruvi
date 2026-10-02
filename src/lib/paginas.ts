/**
 * Título da aba de cada página pública, e o registro da visita no Analytics.
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

/** Painel e telas de login: não vão para o Analytics, só trocam o título da aba. */
export const TITULO_DO_PAINEL = 'Painel | IASD Tucuruvi'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export function tituloDaPagina(pathname: string): string | undefined {
  const alvo = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return TITULOS_DAS_PAGINAS[alvo]
}

/**
 * Troca o título e só então conta a visita. A contagem automática do Analytics dispara
 * quando o endereço muda, antes de a tela nova trocar o título — e registraria a página
 * com o nome da anterior. Por isso a tag sobe com `send_page_view: false` e cada página
 * pública chama esta função quando já sabe o próprio título.
 */
export function registrarVisita(titulo: string): void {
  document.title = titulo
  window.gtag?.('event', 'page_view', { page_title: titulo, page_location: window.location.href })
}
