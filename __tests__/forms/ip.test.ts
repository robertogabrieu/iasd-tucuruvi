import { normalizeIp } from '../../server/modules/forms/forms.ip.utils'

describe('normalizeIp', () => {
  it('aceita endereço comum', () => {
    expect(normalizeIp('187.62.14.203')).toBe('187.62.14.203')
  })

  it('descarta o prefixo que o Node põe em endereço local', () => {
    expect(normalizeIp('::ffff:127.0.0.1')).toBe('127.0.0.1')
  })

  it('aceita endereço no formato novo', () => {
    expect(normalizeIp('2001:db8::1')).toBe('2001:db8::1')
  })

  it('recusa octeto fora da faixa — é o que derrubava a submissão junto', () => {
    expect(normalizeIp('999.1.1.1')).toBeNull()
    expect(normalizeIp('10.0.9.29384')).toBeNull()
    expect(normalizeIp('256.256.256.256')).toBeNull()
  })

  it('recusa texto que não é endereço', () => {
    expect(normalizeIp('unknown')).toBeNull()
    expect(normalizeIp('')).toBeNull()
    expect(normalizeIp(undefined)).toBeNull()
  })
})
