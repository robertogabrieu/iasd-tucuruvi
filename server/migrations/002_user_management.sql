-- server/migrations/002_user_management.sql
-- Convites de usuário (US-06/US-07). Token guardado apenas hashado (sha256).
CREATE TABLE invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       citext NOT NULL,
  role_id     uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  token_hash  text NOT NULL,
  invited_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','accepted','revoked')),
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invitations_token_hash ON invitations(token_hash);
CREATE INDEX idx_invitations_email      ON invitations(email);
