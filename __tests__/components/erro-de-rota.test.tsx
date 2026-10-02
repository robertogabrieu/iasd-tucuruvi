/**
 * @jest-environment jsdom
 */
import { TextDecoder, TextEncoder } from 'util'

// O React Router usa estes dois, que o jsdom não traz. Precisam existir antes de ele carregar.
Object.assign(globalThis, { TextEncoder, TextDecoder })

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import ErroDeRota from '../../src/components/ErroDeRota'

jest.mock('@sentry/react', () => ({ captureException: jest.fn() }))

const captureException = Sentry.captureException as jest.Mock

function PaginaQueQuebra(): never {
  throw new Error('quebrou ao montar a página')
}

let raiz: Root
let container: HTMLElement

function abrir(caminho: string) {
  const router = createMemoryRouter(
    [{ path: '/', errorElement: <ErroDeRota />, children: [{ path: 'quebra', element: <PaginaQueQuebra /> }] }],
    { initialEntries: [caminho] },
  )
  act(() => {
    raiz.render(<RouterProvider router={router} />)
  })
}

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

beforeEach(() => {
  captureException.mockClear()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  container = document.createElement('div')
  document.body.appendChild(container)
  raiz = createRoot(container)
})

afterEach(() => {
  act(() => raiz.unmount())
  container.remove()
  jest.restoreAllMocks()
})

describe('ErroDeRota', () => {
  it('manda ao Sentry, uma vez, o erro que quebrou a página e oferece a volta ao início', () => {
    abrir('/quebra')
    expect(captureException).toHaveBeenCalledTimes(1)
    expect(captureException.mock.calls[0][0]).toEqual(expect.objectContaining({ message: 'quebrou ao montar a página' }))
    expect(container.textContent).toContain('Algo deu errado')
    expect(container.querySelector('a[href="/"]')?.textContent).toBe('Voltar para o início')
  })

  it('não manda ao Sentry o endereço que não existe, e diz que a página não foi encontrada', () => {
    abrir('/nao-existe')
    expect(captureException).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Página não encontrada')
    expect(container.querySelector('a[href="/"]')).not.toBeNull()
  })
})
