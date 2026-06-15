import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { usePersistentState } from './usePersistentState'
import { NAV, isGroup, type NavGroup } from './nav-config'

export default function Sidebar() {
  const [collapsed, setCollapsed] = usePersistentState<boolean>('admin.sidebar.collapsed', false)
  const [openGroups, setOpenGroups] = usePersistentState<string[]>('admin.sidebar.openGroups', [])
  const [flyout, setFlyout] = useState<string | null>(null)
  const { logout } = useAuth()
  const navigate = useNavigate()

  const toggleGroup = (key: string) =>
    setOpenGroups(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const linkBase = 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors'
  const leafClass = ({ isActive }: { isActive: boolean }) =>
    `${linkBase} ${isActive ? 'bg-iasd-accent text-white' : 'text-white/80 hover:bg-white/10'}`

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} shrink-0 bg-iasd-dark text-white flex flex-col
      transition-[width] duration-300 ease-in-out h-screen sticky top-0`}>
      {/* Topo: logo (CA-01) */}
      <div className="flex items-center gap-2 px-3 h-16 border-b border-white/10">
        <img src="/img/logo-iasd.svg" alt="IASD Tucuruvi" className="w-9 h-9 rounded shrink-0" />
        {!collapsed && <span className="font-heading font-bold leading-tight">IASD Tucuruvi</span>}
        <button onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-white/70 hover:text-white" aria-label="Colapsar menu">
          {collapsed ? '»' : '«'}
        </button>
      </div>

      {/* Lista de itens (rola; CA-02/04/05/06) */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {NAV.map(entry => {
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
              <button onClick={() => !collapsed && toggleGroup(group.key)}
                className={`${linkBase} w-full text-white/80 hover:bg-white/10`}
                title={collapsed ? group.label : undefined}>
                {group.icon}
                {!collapsed && <>
                  <span>{group.label}</span>
                  <span className={`ml-auto transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
                </>}
              </button>

              {/* Expandido: subitens inline (CA-04) */}
              {!collapsed && open && (
                <div className="ml-7 mt-1 space-y-1 border-l border-white/10 pl-2">
                  {group.children.map(c => (
                    <NavLink key={c.to} to={c.to} end className={leafClass}>{c.label}</NavLink>
                  ))}
                </div>
              )}

              {/* Trilho: flyout no hover (CA-05) */}
              {collapsed && flyout === group.key && (
                <div className="absolute left-full top-0 ml-1 z-20 w-48 rounded-lg bg-iasd-dark
                  shadow-xl border border-white/10 p-2 space-y-1">
                  <p className="px-2 py-1 text-xs uppercase text-white/50">{group.label}</p>
                  {group.children.map(c => (
                    <NavLink key={c.to} to={c.to} end className={leafClass}>{c.label}</NavLink>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Rodapé: Sair fixo (CA-07) */}
      <div className="border-t border-white/10 p-2">
        <button onClick={handleLogout}
          className={`${linkBase} w-full text-white/80 hover:bg-white/10`}
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
