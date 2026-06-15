import { useAuth } from '@/auth/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-heading font-bold text-iasd-dark mb-2">Painel</h1>
      <p className="text-gray-700">Olá, {user?.name} ({user?.email}).</p>
      <p className="text-sm text-gray-500 mt-1">Papéis: {user?.roles?.join(', ') || '—'}</p>
    </div>
  )
}
