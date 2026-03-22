'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { contatoSchema, type ContatoFormData } from '@/schemas/contato'
import SectionTitle from './SectionTitle'

const horarios = ['Manhã', 'Tarde', 'Noite', 'Qualquer horário']

export default function EstudosBiblicos() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContatoFormData>({
    resolver: zodResolver(contatoSchema),
    defaultValues: { honeypot: '' },
  })

  async function onSubmit(data: ContatoFormData) {
    setStatus('sending')
    try {
      const res = await fetch('/api/contato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      setStatus('success')
      reset()
    } catch {
      setStatus('error')
    }
  }

  return (
    <section id="estudos" className="bg-iasd-light py-20">
      <div className="container mx-auto px-4">
        <SectionTitle
          title="Estudos Bíblicos"
          subtitle="Aprenda mais sobre a Palavra de Deus"
        />
        <div className="mx-auto max-w-xl" data-aos="zoom-in">
          <p className="mb-8 text-gray-700">
            Quer conhecer mais sobre a Bíblia? Preencha o formulário abaixo e entraremos em
            contato para agendar estudos bíblicos gratuitos.
          </p>

          {status === 'success' ? (
            <div className="rounded-lg bg-green-50 p-6 text-center text-green-800">
              <p className="font-bold">Mensagem enviada com sucesso!</p>
              <p className="mt-2 text-sm">Entraremos em contato em breve.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <input type="text" {...register('honeypot')} className="hidden" tabIndex={-1} autoComplete="off" />

              <div>
                <label htmlFor="nome" className="block text-sm font-medium text-gray-700">Nome</label>
                <input
                  id="nome"
                  type="text"
                  {...register('nome')}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-iasd-accent focus:outline-none focus:ring-1 focus:ring-iasd-accent"
                />
                {errors.nome && <p className="mt-1 text-sm text-red-600">{errors.nome.message}</p>}
              </div>

              <div>
                <label htmlFor="telefone" className="block text-sm font-medium text-gray-700">Telefone / WhatsApp</label>
                <input
                  id="telefone"
                  type="tel"
                  {...register('telefone')}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-iasd-accent focus:outline-none focus:ring-1 focus:ring-iasd-accent"
                />
                {errors.telefone && <p className="mt-1 text-sm text-red-600">{errors.telefone.message}</p>}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  id="email"
                  type="email"
                  {...register('email')}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-iasd-accent focus:outline-none focus:ring-1 focus:ring-iasd-accent"
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
              </div>

              <div>
                <label htmlFor="horario" className="block text-sm font-medium text-gray-700">Melhor horário para contato</label>
                <select
                  id="horario"
                  {...register('horario')}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-iasd-accent focus:outline-none focus:ring-1 focus:ring-iasd-accent"
                >
                  <option value="">Selecione...</option>
                  {horarios.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                {errors.horario && <p className="mt-1 text-sm text-red-600">{errors.horario.message}</p>}
              </div>

              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full rounded-lg bg-iasd-accent py-3 font-heading font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
              >
                {status === 'sending' ? 'Enviando...' : 'Quero estudar a Bíblia'}
              </button>

              {status === 'error' && (
                <p className="text-center text-sm text-red-600">
                  Erro ao enviar. Tente novamente.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
