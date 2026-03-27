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

echo ""
echo "Rebuildando e reiniciando containers..."
docker compose up --build -d

echo ""
echo "=== Update concluído! ==="
echo "App:     http://localhost:$(grep -oP 'PORT=\K.*' .env.local 2>/dev/null || echo 3001)"
echo "Mailpit: http://localhost:8025"
