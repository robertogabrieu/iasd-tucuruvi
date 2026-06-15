import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { emailSchema } from '@/schemas/auth'
import { apiFetch, ensureCsrf } from '@/auth/auth-api'

type Input = z.infer<typeof emailSchema>

export default function EsqueciSenha() {
  const [enviado, setEnviado] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Input>({ resolver: zodResolver(emailSchema) })

  async function onSubmit(data: Input) {
    await ensureCsrf()
    await apiFetch('/forgot-password', { method: 'POST', body: JSON.stringify(data) })
    setEnviado(true) // resposta sempre genérica
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-iasd-light px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 space-y-4">
        <h1 className="text-xl font-heading font-bold text-iasd-dark text-center">Recuperar acesso</h1>
        {enviado ? (
          <p className="text-sm text-center text-gray-700">
            Se houver uma conta com este e-mail, enviamos um link de redefinição.
          </p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">E-mail</label>
              <input type="email" {...register('email')} className="w-full border rounded px-3 py-2" />
              {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting}
              className="w-full bg-iasd-dark text-white rounded py-2 hover:bg-iasd-accent transition disabled:opacity-60">
              Enviar link
            </button>
          </form>
        )}
        <p className="text-center text-sm">
          <Link to="/login" className="text-iasd-accent hover:underline">Voltar ao login</Link>
        </p>
      </div>
    </main>
  )
}
