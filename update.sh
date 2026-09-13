#!/usr/bin/env bash
set -euo pipefail

echo "=== IASD Tucuruvi — Update ==="
echo ""

if ! command -v docker &>/dev/null; then
  echo "Erro: Docker não está instalado." >&2
  exit 1
fi

# O site publicado sai da master. Em outra branch, o pull misturaria a master nela e subiria
# essa mistura sem aviso; e um merge feito no próprio servidor deixaria prod fora de qualquer
# commit que exista no GitHub.
current_branch="$(git branch --show-current)"
if [[ "$current_branch" != "master" ]]; then
  echo "Erro: o servidor está na branch '${current_branch:-(nenhuma)}', e o site sai da master." >&2
  echo "Rode 'git checkout master' e depois ./update.sh de novo." >&2
  exit 1
fi

echo "Puxando alterações do repositório..."
if ! git pull --ff-only origin master; then
  echo "Erro: a master do servidor tem commits que não estão no GitHub; nada foi atualizado." >&2
  echo "Confira com 'git log origin/master..master' antes de seguir." >&2
  exit 1
fi

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
echo "No ar:   $(git log -1 --format='%h %s')"
echo "App:     http://localhost:$(grep -oP 'PORT=\K.*' .env.local 2>/dev/null || echo 3001)"
echo "Mailpit: http://localhost:8025"
