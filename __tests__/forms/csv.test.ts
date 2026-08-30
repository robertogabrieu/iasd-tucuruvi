import { toCsv } from '../../server/modules/forms/forms.csv'
import type { FormDefinition } from '../../server/modules/forms/dto/form-definition'

const def: FormDefinition = {
  key: 'teste',
  label: 'Teste',
  fields: [
    { key: 'nome', label: 'Nome', type: 'text' },
    { key: 'obs', label: 'Observação', type: 'longtext' },
  ],
}

const linha = (
  data: Record<string, string>,
  extra: Partial<{ notified_at: Date | null; notify_error: string | null }> = {},
) => ({
  id: '1', form_key: 'teste', data,
  notified_at: extra.notified_at ?? null,
  notify_error: extra.notify_error ?? null,
  submitted_ip: null, user_agent: null,
  created_at: new Date('2026-08-30T14:05:00Z'),
})

describe('toCsv', () => {
  it('começa com BOM e usa ponto-e-vírgula no cabeçalho', () => {
    const csv = toCsv(def, [linha({ nome: 'Maria', obs: 'ok' })])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('Recebido em;Nome;Observação;Aviso por e-mail')
  })

  it('separa linhas com CRLF', () => {
    expect(toCsv(def, [linha({ nome: 'Maria', obs: 'ok' })])).toContain('\r\n')
  })

  it('escapa aspas e ponto-e-vírgula dentro do valor', () => {
    const csv = toCsv(def, [linha({ nome: 'Ana; a "boa"', obs: '' })])
    expect(csv).toContain('"Ana; a ""boa"""')
  })

  it('neutraliza valor que a planilha calcularia como fórmula', () => {
    for (const perigoso of ['=1+1', '+1', '-1', '@SUM(A1)']) {
      expect(toCsv(def, [linha({ nome: perigoso, obs: '' })])).toContain(`'${perigoso}`)
    }
  })

  it('descreve a situação do aviso por e-mail', () => {
    expect(toCsv(def, [linha({ nome: 'a', obs: '' }, { notified_at: new Date() })])).toContain('Enviado')
    expect(toCsv(def, [linha({ nome: 'a', obs: '' }, { notify_error: 'timeout' })])).toContain('Falhou')
    expect(toCsv(def, [linha({ nome: 'a', obs: '' })])).toContain('Não configurado')
  })

  it('deixa a célula vazia quando o campo não foi preenchido', () => {
    expect(toCsv(def, [linha({ nome: 'Maria' })])).toContain('Maria;;')
  })

  it('não vaza o endereço de origem', () => {
    const row = { ...linha({ nome: 'Maria', obs: '' }), submitted_ip: '187.62.14.203' }
    expect(toCsv(def, [row])).not.toContain('187.62.14.203')
  })
})
