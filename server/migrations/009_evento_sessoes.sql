CREATE TABLE evento_sessoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id   uuid NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz,
  title       text,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evento_sessoes_termino_depois CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX idx_evento_sessoes_evento ON evento_sessoes (evento_id, starts_at);
CREATE UNIQUE INDEX idx_evento_sessoes_instante ON evento_sessoes (evento_id, starts_at);

-- Cada evento que já existe vira um evento de uma sessão só.
-- O CASE existe porque rascunho pode ter término anterior ao início: a regra só é cobrada
-- na publicação, e a tabela de eventos não tem restrição. Copiado como está, o dado violaria
-- o CHECK acima e a migration derrubaria o boot.
INSERT INTO evento_sessoes (evento_id, starts_at, ends_at)
SELECT id, starts_at, CASE WHEN ends_at > starts_at THEN ends_at END
FROM eventos;
