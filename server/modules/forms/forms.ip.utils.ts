const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
const IPV6 = /^[0-9a-f]{0,4}(:[0-9a-f]{0,4}){2,7}$/i

/**
 * A coluna é `inet`: valor que não é endereço derruba a inserção — e derrubaria a submissão junto,
 * que é exatamente o que este motor existe para impedir. O cabeçalho de origem é escrito por quem
 * envia, então a faixa de cada octeto precisa ser conferida: `999.1.1.1` passa numa checagem só de
 * formato e é recusado pelo banco.
 */
export function normalizeIp(raw: string | undefined): string | null {
  if (!raw) return null
  const ip = raw.replace(/^::ffff:/i, '').trim()
  const v4 = IPV4.exec(ip)
  if (v4) return v4.slice(1).every(o => Number(o) <= 255 && String(Number(o)) === o.replace(/^0+(?=\d)/, '')) ? ip : null
  return IPV6.test(ip) ? ip : null
}
