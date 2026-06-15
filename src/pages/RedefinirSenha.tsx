import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { z } from 'zod'
import { novaSenhaSchema } from '@/schemas/auth'
import { apiFetch, ensureCsrf } from '@/auth/auth-api'

type Input = z.infer<typeof novaSenhaSchema>

export default function RedefinirSenha() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const [erro, setErro] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Input>({ resolver: zodResolver(novaSenhaSchema) })

  async function onSubmit(data: Input) {
    setErro('')
    await ensureCsrf()
    const res = await apiFetch('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password: data.password }),
    })
    if (res.ok) { navigate('/login') }
    else {
      const body = await res.json().catch(() => ({}))
      setErro(body.error || 'Não foi possível redefinir a senha.')
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-iasd-light px-4">
        <p className="text-gray-700">Link inválido. <Link to="/esqueci-senha" className="text-iasd-accent underline">Solicitar novo</Link>.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-iasd-light px-4">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 space-y-4">
        <h1 className="text-xl font-heading font-bold text-iasd-dark text-center">Nova senha</h1>
        {erro && <p className="text-red-600 text-sm text-center">{erro}</p>}
        <div>
          <label className="block text-sm mb-1">Nova senha</label>
          <input type="password" {...register('password')} className="w-full border rounded px-3 py-2" />
          {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>}
        </div>
        <div>
          <label className="block text-sm mb-1">Confirmar senha</label>
          <input type="password" {...register('confirm')} className="w-full border rounded px-3 py-2" />
          {errors.confirm && <p className="text-red-600 text-xs mt-1">{errors.confirm.message}</p>}
        </div>
        <button type="submit" disabled={isSubmitting}
          className="w-full bg-iasd-dark text-white rounded py-2 hover:bg-iasd-accent transition disabled:opacity-60">
          Redefinir
        </button>
      </form>
    </main>
  )
}
