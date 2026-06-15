import type { ReactNode } from 'react'

export interface NavLeaf { label: string; to: string }
export interface NavGroup { key: string; label: string; icon: ReactNode; children: NavLeaf[] }
export interface NavItem { key: string; label: string; icon: ReactNode; to: string }
export type NavEntry = NavItem | NavGroup

export function isGroup(e: NavEntry): e is NavGroup {
  return (e as NavGroup).children !== undefined
}

const icon = (d: string): ReactNode => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

// Caminhos de ícones (Heroicons outline simplificados).
const I = {
  dashboard: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10',
  content: 'M4 6h16M4 12h16M4 18h10',
  users: 'M16 14a4 4 0 10-8 0M12 7a3 3 0 100-6 3 3 0 000 6M3 20a6 6 0 0118 0',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6M19 12a7 7 0 00-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1L14.5 2h-5l-.3 2.6a7 7 0 00-1.7 1l-2.4-1-2 3.4L2.1 11a7 7 0 000 2l-2 1.6 2 3.4 2.4-1a7 7 0 001.7 1l.3 2.6h5l.3-2.6a7 7 0 001.7-1l2.4 1 2-3.4-2-1.6a7 7 0 00.1-1z',
}

export const NAV: NavEntry[] = [
  { key: 'dashboard', label: 'Dashboard', icon: icon(I.dashboard), to: '/painel' },
  {
    key: 'conteudo', label: 'Conteúdo', icon: icon(I.content), children: [
      { label: 'Sermões', to: '/painel/conteudo/sermoes' },
      { label: 'Galeria', to: '/painel/conteudo/galeria' },
      { label: 'Departamentos', to: '/painel/conteudo/departamentos' },
    ],
  },
  {
    key: 'usuarios', label: 'Usuários', icon: icon(I.users), children: [
      { label: 'Lista', to: '/painel/usuarios' },
      { label: 'Convites', to: '/painel/usuarios/convites' },
      { label: 'Papéis', to: '/painel/usuarios/papeis' },
    ],
  },
  { key: 'configuracoes', label: 'Configurações', icon: icon(I.settings), to: '/painel/configuracoes' },
]
