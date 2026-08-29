-- server/migrations/005_boletins.sql
-- Boletim Informativo: editor de blocos + publicação (US-16/US-18/US-19).
CREATE TABLE boletins (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL,
  summary        text,
  cover_media_id uuid REFERENCES media(id) ON DELETE SET NULL,
  content        jsonb NOT NULL DEFAULT '[]'::jsonb,
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  slug           text,
  published_at   timestamptz,
  created_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Slug único apenas quando preenchido (rascunhos têm slug NULL).
CREATE UNIQUE INDEX idx_boletins_slug ON boletins (slug) WHERE slug IS NOT NULL;
-- Listagem pública/admin por estado e data.
CREATE INDEX idx_boletins_status_published ON boletins (status, published_at DESC);
CREATE INDEX idx_boletins_created_at ON boletins (created_at DESC);
