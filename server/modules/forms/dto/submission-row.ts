/** Uma linha de `form_submissions`. Compartilhada por repositório, serviço e exportação. */
export interface SubmissionRow {
  id: string
  form_key: string
  data: Record<string, string>
  notified_at: Date | null
  notify_error: string | null
  submitted_ip: string | null
  user_agent: string | null
  created_at: Date
}
