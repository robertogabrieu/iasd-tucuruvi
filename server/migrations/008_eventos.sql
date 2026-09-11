CREATE TABLE eventos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text NOT NULL,
  summary             text,
  description         jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  category            text,
  starts_at           timestamptz NOT NULL,
  ends_at             timestamptz,
  location_name       text NOT NULL,
  location_address    text,
  cover_mode          text NOT NULL DEFAULT 'foto' CHECK (cover_mode IN ('foto', 'arte')),
  cover_style         text NOT NULL DEFAULT 'classico' CHECK (cover_style IN ('classico', 'vibrante', 'sobrio')),
  accent_color        text NOT NULL DEFAULT '#0055AA' CHECK (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color     text NOT NULL DEFAULT '#003366' CHECK (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  host_name           text,
  host_role           text,
  host_photo_media_id uuid REFERENCES media(id) ON DELETE SET NULL,
  art_media_id        uuid REFERENCES media(id) ON DELETE SET NULL,
  cta_label           text,
  cta_url             text,
  status              text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  slug                text,
  published_at        timestamptz,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_eventos_slug ON eventos (slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_eventos_status_starts ON eventos (status, starts_at);
CREATE INDEX idx_eventos_created_at ON eventos (created_at DESC);
