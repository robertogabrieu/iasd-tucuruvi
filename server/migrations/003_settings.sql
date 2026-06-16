-- server/migrations/003_settings.sql
-- Configurações do sistema, chave→valor (US-14). Segredos reversíveis ficam em linha própria,
-- com value = envelope cifrado (US-15).
CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);
