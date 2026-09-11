-- server/migrations/006_boletim_templates.sql
-- Templates de boletim (US-21): um template é um boletim marcado, nunca publicado.
ALTER TABLE boletins ADD COLUMN is_template boolean NOT NULL DEFAULT false;

-- Integridade: template nunca é publicado nem tem link público.
ALTER TABLE boletins ADD CONSTRAINT chk_template_unpublished
  CHECK (NOT is_template OR (status = 'draft' AND slug IS NULL));

-- Listagem de templates por data.
CREATE INDEX idx_boletins_is_template ON boletins (is_template, created_at DESC);
