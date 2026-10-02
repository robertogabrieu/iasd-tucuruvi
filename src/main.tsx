import * as Sentry from '@sentry/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './App'
import { AuthProvider } from './auth/AuthContext'
import { opcoesDoSentry } from './lib/sentry'
import './globals.css'

// Antes de montar a aplicação, para pegar também o erro que acontece já na primeira tela.
Sentry.init(opcoesDoSentry(import.meta.env.PROD))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>
)
