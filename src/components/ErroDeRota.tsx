import { useEffect } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import * as Sentry from '@sentry/react'

// Sem esta tela, o erro que quebra uma página fica com o React Router, que mostra a tela de
// erro dele e não deixa o erro chegar ao Sentry. Endereço que não existe não é defeito do
// site: aparece para o visitante, mas não vai para o Sentry.
export default function ErroDeRota() {
  const erro = useRouteError()
  const naoEncontrada = isRouteErrorResponse(erro) && erro.status === 404

  useEffect(() => {
    if (!naoEncontrada) Sentry.captureException(erro)
  }, [erro, naoEncontrada])

  // Link comum, e não do roteador: a volta recarrega o site, que é o que tira o visitante de
  // uma página quebrada.
  return (
    <main className="flex min-h-screen items-center justify-center bg-iasd-light px-6">
      <div className="max-w-md text-center">
        <h1 className="font-heading text-3xl font-bold text-iasd-dark">
          {naoEncontrada ? 'Página não encontrada' : 'Algo deu errado'}
        </h1>
        <p className="mt-4 text-lg text-gray-700">
          {naoEncontrada
            ? 'O endereço que você abriu não existe ou mudou de lugar.'
            : 'Esta página não abriu como deveria. Já fomos avisados do problema.'}
        </p>
        <a
          href="/"
          className="mt-8 inline-block rounded-full bg-iasd-dark px-8 py-3 font-heading font-bold text-white transition-colors hover:bg-iasd-accent"
        >
          Voltar para o início
        </a>
      </div>
    </main>
  )
}
