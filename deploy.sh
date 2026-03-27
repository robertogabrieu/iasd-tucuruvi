#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker &>/dev/null; then
  echo "Erro: Docker não está instalado." >&2
  echo "Instale em https://docs.docker.com/engine/install/" >&2
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo "Erro: Docker Compose não está disponível." >&2
  exit 1
fi

echo "Parando containers existentes..."
docker compose down --remove-orphans

echo "Buildando e subindo containers..."
docker compose up --build -d

echo ""
echo "Deploy concluído!"
echo "App: http://localhost:3001"
echo "Mailpit: http://localhost:8025"
