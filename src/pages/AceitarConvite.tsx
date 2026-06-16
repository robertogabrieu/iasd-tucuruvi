import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSearchParams, Link } from 'react-router-dom'
import { z } from 'zod'
import { aceitarConviteSchema } from '@/schemas/auth'
import { apiFetch, ensureCsrf } from '@/auth/auth-api'
import { AuthCard, Field, Input, Button, Alert } from '@/painel/ui'

type Input = z.infer<typeof aceitarConviteSchema>

export default function AceitarConvite() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [erro, setErro] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Input>({ resolver: zodResolver(aceitarConviteSchema) })

  async function onSubmit(data: Input) {
    setErro('')
    await ensureCsrf()
    const res = await apiFetch('/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token, name: data.name, password: data.password }),
    })
    if (res.ok) {
      // Reload completo: o AuthProvider roda /me no boot e pega a sessão recém-criada.
      window.location.href = '/painel'
    } else {
      const body = await res.json().catch(() => ({}))
      setErro(body.error || 'Não foi possível aceitar o convite.')
    }
  }

  if (!token) {
    return (
      <AuthCard title="Ativar acesso">
        <p className="text-gray-700 text-sm text-center">
          Convite inválido.{' '}
          <Link to="/login" className="text-iasd-accent underline">Ir para o login</Link>.
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Ativar acesso">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {erro && <Alert kind="err">{erro}</Alert>}
        <Field label="Seu nome" error={errors.name?.message} htmlFor="name">
          <Input id="name" type="text" {...register('name')} />
        </Field>
        <Field label="Senha" error={errors.password?.message} htmlFor="password">
          <Input id="password" type="password" {...register('password')} />
        </Field>
        <Field label="Confirmar senha" error={errors.confirm?.message} htmlFor="confirm">
          <Input id="confirm" type="password" {...register('confirm')} />
        </Field>
        <Button type="submit" disabled={isSubmitting} full>
          Ativar acesso
        </Button>
      </form>
    </AuthCard>
  )
}
