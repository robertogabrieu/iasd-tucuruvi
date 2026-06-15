import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, Link } from 'react-router-dom'
import { loginSchema, type LoginInput } from '@/schemas/auth'
import { useAuth } from '@/auth/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [erro, setErro] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginInput) {
    setErro('')
    try {
      await login(data.email, data.password)
      navigate('/painel')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao entrar')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-iasd-light px-4">
      <form onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 space-y-4">
        <h1 className="text-2xl font-heading font-bold text-iasd-dark text-center">Painel Administrativo</h1>
        {erro && <p className="text-red-600 text-sm text-center">{erro}</p>}
        <div>
          <label className="block text-sm mb-1">E-mail</label>
          <input type="email" {...register('email')} className="w-full border rounded px-3 py-2" />
          {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-sm mb-1">Senha</label>
          <input type="password" {...register('password')} className="w-full border rounded px-3 py-2" />
          {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>}
        </div>
        <button type="submit" disabled={isSubmitting}
          className="w-full bg-iasd-dark text-white rounded py-2 hover:bg-iasd-accent transition disabled:opacity-60">
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="text-center text-sm">
          <Link to="/esqueci-senha" className="text-iasd-accent hover:underline">Esqueci minha senha</Link>
        </p>
      </form>
    </main>
  )
}
