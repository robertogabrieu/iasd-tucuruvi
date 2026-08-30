export type FieldType = 'text' | 'longtext' | 'email' | 'phone' | 'choice' | 'date'

/** Tipos em que faz sentido procurar por trecho. */
export const TEXTUAL_TYPES: FieldType[] = ['text', 'longtext', 'email', 'phone']

export interface FormField {
  key: string
  /** Rótulo que a pessoa viu no site. Vira cabeçalho de coluna e do arquivo exportado. */
  label: string
  type: FieldType
  required?: boolean
  /** Obrigatório quando type === 'choice'. */
  options?: string[]
  maxLength?: number
  /** Vira coluna na listagem. No máximo 4 por formulário. */
  inList?: boolean
  /** Entra na busca livre. Só em campos de texto. */
  searchable?: boolean
}

export interface FormDefinition {
  /** Segmento de URL: minúsculas, dígitos e hífens. */
  key: string
  label: string
  description?: string
  fields: FormField[]
  /** Ausente = o formulário não avisa ninguém; a submissão só é gravada. */
  notify?: { subject: string; to?: string }
}

/** O que o painel recebe: sem o destinatário do aviso. */
export interface PublicFormDefinition {
  key: string
  label: string
  description?: string
  fields: FormField[]
}

export const MAX_LIST_COLUMNS = 4
