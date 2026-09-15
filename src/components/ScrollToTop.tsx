import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * Ao trocar de página, a rolagem volta ao topo. Sem isso o router mantém a posição da
 * página anterior: quem clica num link no meio de uma página longa chega na seguinte já
 * no meio dela, sem ver o título que explica o que é aquilo.
 *
 * Duas exceções. URL com hash: quem manda na rolagem é a seção de destino. Voltar e
 * avançar do navegador: ali o esperado é reencontrar a página onde ela estava.
 *
 * `behavior: 'instant'` é obrigatório — o `scroll-behavior: smooth` do CSS global vale
 * para esta chamada também, e animaria a página antiga subindo antes de trocar.
 *
 * Com a transição de página rodando, a rolagem espera a página antiga terminar de apagar
 * (src/globals.css): subir antes faria a página que está saindo pular para o topo diante de
 * quem olha.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const navegacao = useNavigationType()

  useEffect(() => {
    if (hash) return
    if (navegacao === 'POP') return

    const voltarAoTopo = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    const transicao = (document as DocumentoComTransicao).activeViewTransition
    if (!transicao) {
      voltarAoTopo()
      return
    }

    let cancelada = false
    transicao.ready
      .then(() => saidaDaPagina()?.finished)
      .catch(() => undefined)
      .then(() => {
        if (!cancelada) voltarAoTopo()
      })
    return () => {
      cancelada = true
    }
  }, [pathname, hash, navegacao])

  return null
}

// O TypeScript do projeto ainda não declara a transição ativa do documento.
type DocumentoComTransicao = Document & {
  activeViewTransition?: { ready: Promise<void> } | null
}

// Sem animação de saída (quem pediu menos movimento), não há o que esperar.
function saidaDaPagina(): Animation | undefined {
  return document
    .getAnimations()
    .find((animacao) => (animacao.effect as KeyframeEffect | null)?.pseudoElement === '::view-transition-old(page)')
}
