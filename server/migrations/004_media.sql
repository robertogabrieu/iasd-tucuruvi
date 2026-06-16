-- server/migrations/004_media.sql
-- Biblioteca de mídia (US-17).
CREATE TABLE media (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename           text NOT NULL,
  original_name      text NOT NULL,
  mime_type          text NOT NULL,
  size_bytes         bigint NOT NULL,
  width              integer NOT NULL,
  height             integer NOT NULL,
  thumbnail_filename text NOT NULL,
  uploaded_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_created_at ON media (created_at DESC);
