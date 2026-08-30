import { adminFetch } from '@/painel/admin-api'

export type FieldType = 'text' | 'longtext' | 'email' | 'phone' | 'choice' | 'date'

export interface FormField {
  key: string
  label: string
  type: FieldType
  required?: boolean
  options?: string[]
  inList?: boolean
  searchable?: boolean
}

export interface FormSummary {
  key: string
  label: string
  description?: string
  fields: FormField[]
  notifies: boolean
  total: number
  lastAt: string | null
}

export interface Submission {
  id: string
  data: Record<string, string>
  notified_at: string | null
  notify_error: string | null
  submitted_ip: string | null
  created_at: string
}

export interface PageInfo { page: number; limit: number; total: number; totalPages: number }

export async function listarFormularios(): Promise<FormSummary[]> {
  const res = await adminFetch('/formularios')
  if (!res.ok) throw new Error('Não foi possível carregar os formulários.')
  return (await res.json()).data
}

export async function listarSubmissoes(
  formKey: string, params: URLSearchParams,
): Promise<{ data: Submission[]; pagination: PageInfo }> {
  const res = await adminFetch(`/formularios/${formKey}/submissoes?${params}`)
  if (!res.ok) throw new Error('Não foi possível carregar os envios.')
  return res.json()
}

function nomeDoArquivo(header: string | null): string | null {
  return header?.match(/filename="([^"]+)"/)?.[1] ?? null
}

/**
 * O download NÃO pode ser um <a href> para a rota: o cookie de sessão dura ~15 min e a renovação
 * só acontece dentro do adminFetch. Uma tela aberta há mais tempo entregaria um JSON de erro no
 * lugar da planilha, sem explicação nenhuma.
 */
export async function baixarCsv(formKey: string, params: URLSearchParams): Promise<void> {
  const res = await adminFetch(`/formularios/${formKey}/submissoes.csv?${params}`)
  if (!res.ok) throw new Error('Não foi possível exportar os envios.')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeDoArquivo(res.headers.get('Content-Disposition')) ?? `${formKey}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Rótulo da situação do aviso — mesma regra do arquivo exportado. */
export function situacaoDoAviso(s: Submission, avisa: boolean): 'Enviado' | 'Falhou' | 'Pendente' | 'Não configurado' {
  if (s.notified_at) return 'Enviado'
  if (s.notify_error) return 'Falhou'
  return avisa ? 'Pendente' : 'Não configurado'
}
