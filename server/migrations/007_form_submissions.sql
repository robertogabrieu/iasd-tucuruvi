-- server/migrations/007_form_submissions.sql
-- Motor de formulários: toda submissão de todo formulário público (US-30).
-- form_key é texto sem chave estrangeira de propósito: o catálogo vive no código, não no banco.
CREATE TABLE form_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_key      text NOT NULL,
  data          jsonb NOT NULL,
  notified_at   timestamptz,
  notify_error  text,
  submitted_ip  inet,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Listagem e filtro por período sempre partem de um formulário.
CREATE INDEX idx_form_submissions_form_created ON form_submissions (form_key, created_at DESC);
