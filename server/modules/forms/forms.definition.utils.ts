import { z } from 'zod'
import {
  MAX_LIST_COLUMNS, TEXTUAL_TYPES,
  type FormDefinition, type FormField, type PublicFormDefinition,
} from './dto/form-definition.js'

const KEY_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[\d\s()+-]+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const DEFAULT_MAX_LENGTH: Record<FormField['type'], number> = {
  text: 200, longtext: 2000, email: 200, phone: 20, choice: 200, date: 10,
}

/**
 * Roda no boot, antes de as rotas subirem. Definição inconsistente só apareceria quebrada na tela
 * semanas depois, e a tela não tem como se defender dela — então o servidor recusa subir.
 */
export function validateCatalog(forms: FormDefinition[]): void {
  const seen = new Set<string>()
  for (const f of forms) {
    if (!KEY_RE.test(f.key)) {
      throw new Error(`Formulário "${f.key}": a chave precisa ser minúsculas, dígitos e hífens.`)
    }
    if (seen.has(f.key)) throw new Error(`Formulário "${f.key}": chave repetida no catálogo.`)
    seen.add(f.key)

    const fieldKeys = new Set<string>()
    for (const c of f.fields) {
      if (!KEY_RE.test(c.key)) {
        throw new Error(`Formulário "${f.key}", campo "${c.key}": chave fora do formato.`)
      }
      if (fieldKeys.has(c.key)) {
        throw new Error(`Formulário "${f.key}", campo "${c.key}": chave repetida.`)
      }
      fieldKeys.add(c.key)
      if (c.type === 'choice' && (!c.options || c.options.length === 0)) {
        throw new Error(`Formulário "${f.key}", campo "${c.key}": campo de escolha sem opções.`)
      }
      if (c.searchable && !TEXTUAL_TYPES.includes(c.type)) {
        throw new Error(`Formulário "${f.key}", campo "${c.key}": busca só vale em campo de texto.`)
      }
    }

    const listCount = f.fields.filter(c => c.inList).length
    if (listCount > MAX_LIST_COLUMNS) {
      throw new Error(
        `Formulário "${f.key}": ${listCount} campos marcados como coluna; o limite é quatro. ` +
        'Os demais aparecem no detalhe.',
      )
    }
  }
}

/**
 * Um só `superRefine` por campo em vez de encadear validadores de tipos diferentes: mantém todo
 * campo como uma cadeia de string, que é o que o painel e o CSV esperam receber.
 */
function fieldSchema(c: FormField): z.ZodType<string> {
  const max = c.maxLength ?? DEFAULT_MAX_LENGTH[c.type]
  const options = c.options ?? []
  return z.string().max(max, `Máximo de ${max} caracteres.`).superRefine((value, ctx) => {
    const add = (message: string) => ctx.addIssue({ code: 'custom', message })
    if (value === '') {
      if (c.required) add('Campo obrigatório.')
      return
    }
    if (c.type === 'choice' && !options.includes(value)) add('Opção inválida.')
    if (c.type === 'email' && !EMAIL_RE.test(value)) add('E-mail inválido.')
    if (c.type === 'phone' && !PHONE_RE.test(value)) add('Telefone inválido.')
    if (c.type === 'date' && !DATE_RE.test(value)) add('Data inválida.')
  })
}

/** Zod do envio, derivado da definição. Campo desconhecido é recusado. */
export function buildSubmissionSchema(def: FormDefinition) {
  const shape: Record<string, z.ZodTypeAny> = { honeypot: z.string().max(0) }
  for (const c of def.fields) {
    const s = fieldSchema(c)
    shape[c.key] = c.required ? s : s.optional()
  }
  return z.strictObject(shape)
}

/** Projeção enviada ao painel: sem o destinatário do aviso. */
export function toPublicDefinition(def: FormDefinition): PublicFormDefinition {
  const { key, label, description, fields } = def
  return { key, label, description, fields }
}
