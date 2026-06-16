import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { usePersistentState } from './usePersistentState'
import { NAV, isGroup, type NavGroup } from './nav-config'

export default function Sidebar() {
  const [collapsed, setCollapsed] = usePersistentState<boolean>('admin.sidebar.collapsed', false)
  const [openGroups, setOpenGroups] = usePersistentState<string[]>('admin.sidebar.openGroups', [])
  const [flyout, setFlyout] = useState<string | null>(null)
  const { logout, hasPermission } = useAuth()
  const navigate = useNavigate()

  const toggleGroup = (key: string) =>
    setOpenGroups(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const linkBase = 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors'
  const leafClass = ({ isActive }: { isActive: boolean }) =>
    `${linkBase} ${isActive
      ? 'bg-iasd-accent text-white shadow-sm'
      : 'text-white/75 hover:text-white hover:bg-white/10'}`

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} shrink-0 bg-iasd-dark text-white flex flex-col
      transition-[width] duration-300 ease-in-out h-screen sticky top-0`}>
      {/* Topo: expandido = logo + nome; colapsado = só o botão de expandir */}
      <div className="flex items-center gap-2 px-3 h-16 border-b border-white/10 shrink-0">
        {!collapsed && <img src="/img/logo-iasd.svg" alt="IASD Tucuruvi" className="w-8 h-8 rounded shrink-0" />}
        {!collapsed && <span className="font-heading font-bold text-sm leading-tight tracking-wide">IASD Tucuruvi</span>}
        <button onClick={() => setCollapsed(!collapsed)}
          className={`${collapsed ? 'mx-auto' : 'ml-auto'} rounded-md p-1 text-white/60 hover:text-white hover:bg-white/10 transition-colors`}
          aria-label={collapsed ? 'Expandir menu' : 'Colapsar menu'}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {collapsed
              ? <><path d="m6 17 5-5-5-5" /><path d="m13 17 5-5-5-5" /></>
              : <><path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" /></>}
          </svg>
        </button>
      </div>

      {/* Lista de itens. No trilho usa overflow-visible para o flyout "escapar" sem gerar
          scroll horizontal; expandido rola na vertical. (CA-02/04/05/06) */}
      <nav className={`flex-1 px-2 py-4 space-y-0.5 ${collapsed ? 'overflow-visible' : 'overflow-y-auto'}`}>
        {NAV.filter(e => !e.perm || hasPermission(e.perm)).map(entry => {
          if (!isGroup(entry)) {
            return (
              <NavLink key={entry.key} to={entry.to} end={entry.to === '/painel'} className={leafClass}
                title={collapsed ? entry.label : undefined}>
                {entry.icon}{!collapsed && <span>{entry.label}</span>}
              </NavLink>
            )
          }
          const group = entry as NavGroup
          const open = openGroups.includes(group.key)
          return (
            <div key={group.key} className="relative"
              onMouseEnter={() => collapsed && setFlyout(group.key)}
              onMouseLeave={() => collapsed && setFlyout(null)}>
              <button onClick={() => {
                  if (collapsed) {
                    setFlyout(prev => prev === group.key ? null : group.key)
                  } else {
                    toggleGroup(group.key)
                  }
                }}
                className={`${linkBase} w-full text-white/75 hover:text-white hover:bg-white/10`}
                title={collapsed ? group.label : undefined}>
                {group.icon}
                {!collapsed && <>
                  <span>{group.label}</span>
                  <svg viewBox="0 0 24 24" className={`ml-auto w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </>}
              </button>

              {/* Expandido: subitens inline (CA-04) */}
              {!collapsed && open && (
                <div className="ml-7 mt-0.5 space-y-0.5 border-l border-white/15 pl-2">
                  {group.children.map(c => (
                    <NavLink key={c.to} to={c.to} end className={leafClass}>{c.label}</NavLink>
                  ))}
                </div>
              )}

              {/* Trilho: flyout no hover (CA-05). O wrapper começa em left-full (encostado no
                  trilho) e o pl-2 é uma "ponte" transparente de hover até o card — evita que o
                  popover suma ao mover o mouse no vão entre o ícone e o menu. */}
              {collapsed && flyout === group.key && (
                <div className="absolute left-full top-0 z-20 pl-2">
                  <div className="w-48 rounded-lg bg-iasd-dark shadow-xl border border-white/10 p-2 space-y-1">
                    <p className="px-2 py-1 text-xs uppercase text-white/50">{group.label}</p>
                    {group.children.map(c => (
                      <NavLink key={c.to} to={c.to} end className={leafClass}>{c.label}</NavLink>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Rodapé: Sair fixo (CA-07) */}
      <div className="border-t border-white/10 p-2 shrink-0">
        <button onClick={handleLogout}
          className={`${linkBase} w-full text-white/75 hover:text-white hover:bg-white/10`}
          title={collapsed ? 'Sair' : undefined}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          </svg>
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  )
}
