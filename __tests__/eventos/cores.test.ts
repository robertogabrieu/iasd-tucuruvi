import {
  COR_PADRAO_DESTAQUE,
  COR_PADRAO_SECUNDARIA,
  contraste,
  textoSobre,
  avisoDeContraste,
} from '../../server/core/cores'

describe('contraste', () => {
  it('vai de 1 (cores iguais) a 21 (preto no branco)', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
    expect(contraste('#0055AA', '#0055AA')).toBeCloseTo(1, 2)
  })

  it('não depende da ordem das cores', () => {
    expect(contraste('#003366', '#FFD400')).toBeCloseTo(contraste('#FFD400', '#003366'), 5)
  })
})

describe('textoSobre', () => {
  it('escolhe a cor de texto legível sozinho', () => {
    expect(textoSobre('#003366')).toBe('#FFFFFF')
    expect(textoSobre('#FFD400')).toBe('#0A0A0A')
  })
})

describe('avisoDeContraste', () => {
  it('não acusa o par padrão da igreja', () => {
    expect(avisoDeContraste(COR_PADRAO_DESTAQUE, COR_PADRAO_SECUNDARIA)).toBeNull()
  })

  it('não acusa duas cores bem separadas', () => {
    expect(avisoDeContraste('#FFD400', '#003366')).toBeNull()
  })

  it('avisa quando as duas cores são praticamente a mesma', () => {
    const aviso = avisoDeContraste('#003366', '#00376E')
    expect(aviso).not.toBeNull()
    expect(aviso).toMatch(/cores/i)
  })

  it('fica calado enquanto o hexadecimal está incompleto', () => {
    expect(avisoDeContraste('#00', COR_PADRAO_SECUNDARIA)).toBeNull()
  })
})
