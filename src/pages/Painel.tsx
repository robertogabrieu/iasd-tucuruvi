import { useAuth } from '@/auth/AuthContext'

export default function Painel() {
  const { user, logout } = useAuth()
  return (
    <main className="min-h-screen bg-iasd-light p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-8">
        <h1 className="text-2xl font-heading font-bold text-iasd-dark mb-2">Painel</h1>
        <p className="text-gray-700">Olá, {user?.name} ({user?.email}).</p>
        <p className="text-sm text-gray-500 mt-1">Papéis: {user?.roles?.join(', ') || '—'}</p>
        <button onClick={logout}
          className="mt-6 bg-iasd-dark text-white rounded px-4 py-2 hover:bg-iasd-accent transition">
          Sair
        </button>
      </div>
    </main>
  )
}
