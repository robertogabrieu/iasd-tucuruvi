const NOMES_PROIBIDOS = ['Link', 'NavLink', 'useNavigate']

/**
 * Nomes de navegação importados direto do roteador num texto de arquivo. Casa o bloco de
 * importação inteiro — mesmo quebrado em várias linhas — e usa o nome de antes do `as`, para que
 * um apelido não esvazie a trava. Importação só de tipo fica de fora: tipo não navega.
 */
export function importacoesDiretasDeNavegacao(codigo: string): string[] {
  const bloco = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]react-router(?:-dom)?['"]/g
  const achados: string[] = []
  for (const encontro of codigo.matchAll(bloco)) {
    if (encontro[1]) continue
    for (const parte of encontro[2].split(',')) {
      const especificador = parte.trim()
      if (!especificador || especificador.startsWith('type ')) continue
      const nome = especificador.split(/\s+as\s+/)[0].trim()
      if (NOMES_PROIBIDOS.includes(nome)) achados.push(nome)
    }
  }
  return achados
}

describe('importacoesDiretasDeNavegacao', () => {
  it('acusa importação simples', () => {
    expect(importacoesDiretasDeNavegacao("import { Link } from 'react-router-dom'")).toEqual(['Link'])
  })

  it('acusa importação com apelido', () => {
    expect(importacoesDiretasDeNavegacao("import { Link as L } from 'react-router-dom'")).toEqual(['Link'])
  })

  it('acusa importação em várias linhas vinda de react-router', () => {
    const codigo = "import {\n  useLocation,\n  NavLink,\n  useNavigate,\n} from 'react-router'"
    expect(importacoesDiretasDeNavegacao(codigo)).toEqual(['NavLink', 'useNavigate'])
  })

  it('ignora o que não navega', () => {
    expect(importacoesDiretasDeNavegacao("import { useLocation, Outlet } from 'react-router-dom'")).toEqual([])
  })

  it('ignora importação só de tipo', () => {
    expect(importacoesDiretasDeNavegacao("import type { LinkProps } from 'react-router-dom'")).toEqual([])
    expect(importacoesDiretasDeNavegacao("import { type NavLinkProps } from 'react-router-dom'")).toEqual([])
  })

  it('ignora o ponto único de navegação', () => {
    expect(importacoesDiretasDeNavegacao("import { Link, useNavigate } from '@/lib/navigation'")).toEqual([])
  })
})
