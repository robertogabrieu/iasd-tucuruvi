import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, Link } from 'react-router-dom'
import { loginSchema, type LoginInput } from '@/schemas/auth'
import { useAuth } from '@/auth/AuthContext'
import { AuthCard, Field, Input, Button, Alert } from '@/painel/ui'

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
    <AuthCard
      title="Painel Administrativo"
      footer={<Link to="/esqueci-senha" className="text-iasd-accent hover:underline">Esqueci minha senha</Link>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {erro && <Alert kind="err">{erro}</Alert>}
        <Field label="E-mail" error={errors.email?.message} htmlFor="email">
          <Input id="email" type="email" {...register('email')} />
        </Field>
        <Field label="Senha" error={errors.password?.message} htmlFor="password">
          <Input id="password" type="password" {...register('password')} />
        </Field>
        <Button type="submit" disabled={isSubmitting} full>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </AuthCard>
  )
}
