import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader, Card, Chip } from '@/painel/ui'

/* ── Ícones inline ────────────────────────────────────────────── */
const UsersIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const EnvelopeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
)

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const CogIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33
      1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06
      a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09
      A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68
      a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06
      a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09
      a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

/* ── Tipos dos atalhos ────────────────────────────────────────── */
interface Shortcut {
  key: string
  to: string
  label: string
  description: string
  icon: JSX.Element
  perm: string
}

const SHORTCUTS: Shortcut[] = [
  {
    key: 'usuarios',
    to: '/painel/usuarios',
    label: 'Usuários',
    description: 'Gerencie os usuários do sistema.',
    icon: <UsersIcon />,
    perm: 'users:read',
  },
  {
    key: 'convites',
    to: '/painel/usuarios/convites',
    label: 'Convites',
    description: 'Convide novas pessoas para o painel.',
    icon: <EnvelopeIcon />,
    perm: 'users:invite',
  },
  {
    key: 'papeis',
    to: '/painel/usuarios/papeis',
    label: 'Papéis',
    description: 'Configure papéis e permissões de acesso.',
    icon: <ShieldIcon />,
    perm: 'roles:manage',
  },
  {
    key: 'configuracoes',
    to: '/painel/configuracoes',
    label: 'Configurações',
    description: 'Ajuste as configurações do site.',
    icon: <CogIcon />,
    perm: 'settings:manage',
  },
]

/* ── Componente ───────────────────────────────────────────────── */
export default function Dashboard() {
  const { user, hasPermission } = useAuth()

  const shortcuts = SHORTCUTS.filter(s => hasPermission(s.perm))

  return (
    <div className="space-y-6">
      <PageHeader title="Painel" subtitle="Bem-vindo ao painel administrativo." />

      {/* Card de boas-vindas */}
      <Card title="Olá!">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-medium text-iasd-dark">
              {user?.name ?? 'Usuário'}
            </p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
          {user?.roles && user.roles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {user.roles.map(r => <Chip key={r}>{r}</Chip>)}
            </div>
          )}
        </div>
      </Card>

      {/* Grade de atalhos */}
      {shortcuts.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map(s => (
            <Link
              key={s.key}
              to={s.to}
              className="group bg-white border border-gray-200 rounded-xl shadow-sm p-6
                flex flex-col gap-3 hover:shadow-md hover:border-iasd-accent/40 transition"
            >
              <span className="text-iasd-accent">{s.icon}</span>
              <div>
                <p className="font-heading font-bold text-iasd-dark group-hover:text-iasd-accent transition-colors">
                  {s.label}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">{s.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
