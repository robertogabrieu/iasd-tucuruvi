#!/usr/bin/env bash
set -euo pipefail

echo "=== IASD Tucuruvi — Deploy ==="
echo ""

# --- Verifica Docker ---
if ! command -v docker &>/dev/null; then
  echo "Erro: Docker não está instalado." >&2
  echo "Instale em https://docs.docker.com/engine/install/" >&2
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo "Erro: Docker Compose não está disponível." >&2
  exit 1
fi

if ! command -v openssl &>/dev/null; then
  echo "Erro: openssl não está instalado (necessário para gerar segredos)." >&2
  exit 1
fi

echo "Docker OK: $(docker --version)"
echo ""

# Gera um segredo aleatório em hex. Uso: gen_secret <bytes>
gen_secret() { openssl rand -hex "${1:-32}"; }

# --- Configura .env.local ---
ENV_FILE=".env.local"

if [ -f "$ENV_FILE" ]; then
  echo "Arquivo $ENV_FILE já existe."
  read -rp "Deseja reconfigurar? (s/N): " reconfigure
  if [[ "$reconfigure" != "s" && "$reconfigure" != "S" ]]; then
    echo "Mantendo configuração existente."
  else
    rm "$ENV_FILE"
  fi
fi

if [ ! -f "$ENV_FILE" ]; then
  echo ""
  echo "Configurando variáveis de ambiente..."
  echo "(Pressione Enter para aceitar o valor padrão)"
  echo ""

  read -rp "SMTP Host [localhost]: " smtp_host
  smtp_host="${smtp_host:-localhost}"

  read -rp "SMTP Port [1025]: " smtp_port
  smtp_port="${smtp_port:-1025}"

  read -rp "Email remetente [noreply@iasdtucuruvi.com.br]: " smtp_from
  smtp_from="${smtp_from:-noreply@iasdtucuruvi.com.br}"

  read -rp "Email destinatário [contato@iasdtucuruvi.com.br]: " smtp_to
  smtp_to="${smtp_to:-contato@iasdtucuruvi.com.br}"

  read -rp "Porta da aplicação [3001]: " app_port
  app_port="${app_port:-3001}"

  read -rp "URL pública do site (para o preview do boletim no WhatsApp/Open Graph) [https://www.adventistastucuruvi.com.br]: " public_base_url
  public_base_url="${public_base_url:-https://www.adventistastucuruvi.com.br}"

  echo "Chave da YouTube Data API v3 (para os sermões; o feed público falha em IP de VPS)."
  read -rp "YOUTUBE_API_KEY (deixe em branco para configurar depois): " youtube_api_key

  echo "Credenciais OAuth do Gmail (opcional; deixe em branco para configurar depois)."
  read -rp "GOOGLE_OAUTH_CLIENT_ID: " google_oauth_client_id
  read -rp "GOOGLE_OAUTH_CLIENT_SECRET: " google_oauth_client_secret

  echo ""
  echo "--- Banco de dados (Postgres) ---"
  read -rp "Usuário do Postgres [iasd]: " pg_user
  pg_user="${pg_user:-iasd}"

  read -rp "Nome do banco [iasd]: " pg_db
  pg_db="${pg_db:-iasd}"

  echo ""
  echo "--- Usuário administrador inicial (seed) ---"
  read -rp "E-mail do admin inicial [admin@iasdtucuruvi.com.br]: " seed_email
  seed_email="${seed_email:-admin@iasdtucuruvi.com.br}"

  # Segredos gerados automaticamente (nunca digitados/commitados).
  pg_password="$(gen_secret 24)"
  jwt_access_secret="$(gen_secret 48)"
  jwt_refresh_secret="$(gen_secret 48)"
  csrf_secret="$(gen_secret 32)"
  config_encryption_key="$(gen_secret 32)"
  # Sufixo "Aa1#" garante a política de senha (>=1 maiúscula, minúscula, número e símbolo);
  # o hex sozinho (0-9a-f) seria rejeitado pelo seed e o admin não seria criado.
  seed_password="$(gen_secret 12)Aa1#"

  cat > "$ENV_FILE" <<EOF
# --- SMTP / E-mail ---
SMTP_HOST=$smtp_host
SMTP_PORT=$smtp_port
SMTP_FROM=$smtp_from
SMTP_TO=$smtp_to
PORT=$app_port

# --- App / Open Graph ---
# URL pública absoluta do site, usada nas meta tags do boletim (og:url/og:image).
PUBLIC_BASE_URL=$public_base_url

# --- YouTube (sermões) — chave da YouTube Data API v3 (feed público falha em IP de VPS) ---
YOUTUBE_API_KEY=$youtube_api_key

# --- Gmail OAuth2 (opcional; modo "Gmail (OAuth2)" no painel) ---
GOOGLE_OAUTH_CLIENT_ID=$google_oauth_client_id
GOOGLE_OAUTH_CLIENT_SECRET=$google_oauth_client_secret

# --- Banco de dados (Postgres) ---
POSTGRES_USER=$pg_user
POSTGRES_PASSWORD=$pg_password
POSTGRES_DB=$pg_db
DATABASE_URL=postgres://$pg_user:$pg_password@db:5432/$pg_db

# --- Autenticação (JWT em cookie httpOnly) ---
JWT_ACCESS_SECRET=$jwt_access_secret
JWT_REFRESH_SECRET=$jwt_refresh_secret
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
CSRF_SECRET=$csrf_secret

# --- Criptografia de segredos de configuração (US-15) ---
CONFIG_ENCRYPTION_KEY=$config_encryption_key
CONFIG_ENCRYPTION_KEY_OLD=

# --- Seed do usuário inicial (role 'admin' com todas as permissões) ---
SEED_ADMIN_EMAIL=$seed_email
SEED_ADMIN_PASSWORD=$seed_password
EOF

  echo ""
  echo "Arquivo $ENV_FILE criado (segredos gerados automaticamente)."
  echo ""
  echo "============================================================"
  echo " CREDENCIAIS DO ADMIN INICIAL — anote agora, não se repete:"
  echo "   E-mail: $seed_email"
  echo "   Senha:  $seed_password"
  echo "============================================================"
fi

echo ""

# --- Deploy ---
echo "Parando containers existentes..."
docker compose down --remove-orphans

echo "Buildando e subindo containers..."
docker compose up --build -d

echo ""
echo "=== Deploy concluído! ==="
echo "App:     http://localhost:$(grep -oP 'PORT=\K.*' "$ENV_FILE" 2>/dev/null || echo 3001)"
echo "Mailpit: http://localhost:8025"
