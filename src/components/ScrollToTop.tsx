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
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const navegacao = useNavigationType()

  useEffect(() => {
    if (hash) return
    if (navegacao === 'POP') return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, hash, navegacao])

  return null
}
