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

echo "Docker OK: $(docker --version)"
echo ""

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

  cat > "$ENV_FILE" <<EOF
SMTP_HOST=$smtp_host
SMTP_PORT=$smtp_port
SMTP_FROM=$smtp_from
SMTP_TO=$smtp_to
PORT=$app_port
EOF

  echo ""
  echo "Arquivo $ENV_FILE criado."
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
