import { validateCatalog, buildSubmissionSchema } from '../../server/modules/forms/forms.definition.utils'
import type { FormDefinition } from '../../server/modules/forms/dto/form-definition'

const base: FormDefinition = {
  key: 'teste',
  label: 'Teste',
  fields: [
    { key: 'nome', label: 'Nome', type: 'text', required: true, searchable: true, inList: true },
    { key: 'turno', label: 'Turno', type: 'choice', required: true, options: ['Manhã', 'Tarde'] },
  ],
}

describe('validateCatalog', () => {
  it('aceita um catálogo válido', () => {
    expect(() => validateCatalog([base])).not.toThrow()
  })

  it('recusa chave de formulário repetida', () => {
    expect(() => validateCatalog([base, { ...base }])).toThrow(/teste/)
  })

  it('recusa chave de formulário fora do formato de URL', () => {
    expect(() => validateCatalog([{ ...base, key: 'Teste Form' }])).toThrow(/Teste Form/)
  })

  it('recusa chave de campo repetida dentro do formulário', () => {
    const dup = { ...base, fields: [...base.fields, { key: 'nome', label: 'Outro', type: 'text' as const }] }
    expect(() => validateCatalog([dup])).toThrow(/nome/)
  })

  it('recusa campo de escolha sem opções', () => {
    const semOpcoes = { ...base, fields: [{ key: 'turno', label: 'Turno', type: 'choice' as const }] }
    expect(() => validateCatalog([semOpcoes])).toThrow(/turno/)
  })

  it('recusa mais de quatro colunas de destaque', () => {
    const cinco = {
      ...base,
      fields: ['a', 'b', 'c', 'd', 'e'].map(k => ({ key: k, label: k, type: 'text' as const, inList: true })),
    }
    expect(() => validateCatalog([cinco])).toThrow(/quatro/i)
  })

  it('recusa busca em campo que não é de texto', () => {
    const buscaEmEscolha = {
      ...base,
      fields: [{ key: 'turno', label: 'Turno', type: 'choice' as const, options: ['Manhã'], searchable: true }],
    }
    expect(() => validateCatalog([buscaEmEscolha])).toThrow(/turno/)
  })
})

describe('buildSubmissionSchema', () => {
  const schema = buildSubmissionSchema(base)

  it('aceita um envio válido', () => {
    expect(schema.safeParse({ nome: 'Maria', turno: 'Manhã', honeypot: '' }).success).toBe(true)
  })

  it('recusa obrigatório vazio', () => {
    expect(schema.safeParse({ nome: '', turno: 'Manhã', honeypot: '' }).success).toBe(false)
  })

  it('recusa valor fora das opções', () => {
    expect(schema.safeParse({ nome: 'Maria', turno: 'Madrugada', honeypot: '' }).success).toBe(false)
  })

  it('recusa campo desconhecido', () => {
    expect(schema.safeParse({ nome: 'Maria', turno: 'Manhã', extra: 'x', honeypot: '' }).success).toBe(false)
  })

  it('recusa o campo-armadilha preenchido', () => {
    expect(schema.safeParse({ nome: 'Maria', turno: 'Manhã', honeypot: 'robô' }).success).toBe(false)
  })

  it('recusa e-mail e telefone malformados', () => {
    const def: FormDefinition = { key: 'c', label: 'C', fields: [
      { key: 'email', label: 'E-mail', type: 'email', required: true },
      { key: 'tel', label: 'Telefone', type: 'phone', required: true },
    ] }
    const s = buildSubmissionSchema(def)
    expect(s.safeParse({ email: 'nao-e-email', tel: '11999998888', honeypot: '' }).success).toBe(false)
    expect(s.safeParse({ email: 'a@b.com', tel: 'liga pra mim', honeypot: '' }).success).toBe(false)
    expect(s.safeParse({ email: 'a@b.com', tel: '(11) 99999-8888', honeypot: '' }).success).toBe(true)
  })
})
