import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { z } from 'zod'
import { novaSenhaSchema } from '@/schemas/auth'
import { apiFetch, ensureCsrf } from '@/auth/auth-api'
import { AuthCard, Field, Input, Button, Alert } from '@/painel/ui'

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
      <AuthCard title="Nova senha">
        <p className="text-gray-700 text-sm text-center">
          Link inválido.{' '}
          <Link to="/esqueci-senha" className="text-iasd-accent underline">Solicitar novo</Link>.
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Nova senha">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {erro && <Alert kind="err">{erro}</Alert>}
        <Field label="Nova senha" error={errors.password?.message} htmlFor="password">
          <Input id="password" type="password" {...register('password')} />
        </Field>
        <Field label="Confirmar senha" error={errors.confirm?.message} htmlFor="confirm">
          <Input id="confirm" type="password" {...register('confirm')} />
        </Field>
        <Button type="submit" disabled={isSubmitting} full>
          Redefinir
        </Button>
      </form>
    </AuthCard>
  )
}
