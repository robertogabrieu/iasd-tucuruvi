#!/usr/bin/env bash
set -euo pipefail

echo "=== IASD Tucuruvi — Update ==="
echo ""

if ! command -v docker &>/dev/null; then
  echo "Erro: Docker não está instalado." >&2
  exit 1
fi

echo "Puxando alterações do repositório..."
git pull origin master

# --- Garante variáveis novas no .env.local ---
if [[ ! -f .env.local ]]; then
  echo "Erro: .env.local não encontrado. Rode ./deploy.sh primeiro (configuração inicial)." >&2
  exit 1
fi

# PUBLIC_BASE_URL (novo desde o Boletim) — usado nas meta tags Open Graph (preview no WhatsApp).
if ! grep -qE '^PUBLIC_BASE_URL=.+' .env.local; then
  echo ""
  echo "PUBLIC_BASE_URL ausente no .env.local (necessário para o preview do boletim no WhatsApp)."
  read -rp "URL pública do site [https://www.adventistastucuruvi.com.br]: " public_base_url
  public_base_url="${public_base_url:-https://www.adventistastucuruvi.com.br}"
  sed -i '/^PUBLIC_BASE_URL=$/d' .env.local   # remove linha vazia, se existir
  echo "PUBLIC_BASE_URL=$public_base_url" >> .env.local
  echo "✓ PUBLIC_BASE_URL adicionado ao .env.local."
fi

echo ""
echo "Rebuildando e reiniciando containers..."
docker compose up --build -d

echo ""
echo "=== Update concluído! ==="
echo "App:     http://localhost:$(grep -oP 'PORT=\K.*' .env.local 2>/dev/null || echo 3001)"
echo "Mailpit: http://localhost:8025"
