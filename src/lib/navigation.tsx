import { useCallback } from 'react'
import {
  Link as RouterLink,
  NavLink as RouterNavLink,
  resolvePath,
  useLocation,
  useNavigate as useRouterNavigate,
  useResolvedPath,
} from 'react-router-dom'
import type { LinkProps, NavLinkProps, NavigateFunction, NavigateOptions, To } from 'react-router-dom'

// Toda troca de página passa por aqui para ganhar o esmaecimento (o efeito mora em
// src/globals.css). Só anima quando a página muda: clicar no link da página atual não pisca.

function useMudaDePagina(to: To): boolean {
  const { pathname } = useLocation()
  return useResolvedPath(to).pathname !== pathname
}

export function Link({ to, viewTransition, ...props }: LinkProps) {
  const mudaDePagina = useMudaDePagina(to)
  return <RouterLink to={to} viewTransition={viewTransition ?? mudaDePagina} {...props} />
}

export function NavLink({ to, viewTransition, ...props }: NavLinkProps) {
  const mudaDePagina = useMudaDePagina(to)
  return <RouterNavLink to={to} viewTransition={viewTransition ?? mudaDePagina} {...props} />
}

export function useNavigate(): NavigateFunction {
  const navigate = useRouterNavigate()

  // A página atual é lida na hora da chamada, e não por useLocation: assim a função devolvida não
  // muda a cada navegação, e efeito que depende dela não roda de novo só porque a página trocou.
  const navegarComTransicao = useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === 'number') {
        return navigate(to)
      }
      const atual = window.location.pathname
      const mudaDePagina = resolvePath(to, atual).pathname !== atual
      return navigate(to, { viewTransition: mudaDePagina, ...options })
    },
    [navigate],
  )

  // NavigateFunction é uma sobrecarga (destino ou passos no histórico); uma única função que trata
  // os dois casos só se encaixa nela por asserção.
  return navegarComTransicao as NavigateFunction
}
