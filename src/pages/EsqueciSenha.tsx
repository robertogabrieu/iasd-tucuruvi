import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { emailSchema } from '@/schemas/auth'
import { apiFetch, ensureCsrf } from '@/auth/auth-api'
import { AuthCard, Field, Input, Button, Alert } from '@/painel/ui'

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
    <AuthCard
      title="Recuperar acesso"
      footer={<Link to="/login" className="text-iasd-accent hover:underline">Voltar ao login</Link>}
    >
      {enviado ? (
        <Alert kind="ok">
          Se houver uma conta com este e-mail, enviamos um link de redefinição.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="E-mail" error={errors.email?.message} htmlFor="email">
            <Input id="email" type="email" {...register('email')} />
          </Field>
          <Button type="submit" disabled={isSubmitting} full>
            Enviar link
          </Button>
        </form>
      )}
    </AuthCard>
  )
}
