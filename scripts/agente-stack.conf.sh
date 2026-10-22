# Configuração do IASD Tucuruvi para scripts/agente-stack.sh (o núcleo é igual em todo projeto).
# shellcheck shell=bash

AGENTE_PREFIXO="iasd-ag-"
AGENTE_PROJETO_REGISTRO="iasd-tucuruvi"
AGENTE_COMPOSE=(docker-compose.agente.yml)
AGENTE_COMPOSE_TESTES=(docker-compose.agente-testes.yml)
AGENTE_PASTAS=(node_modules)
AGENTE_MEM_UP_MB=2200     # banco 384 + e-mail 96 + app 1536; o pico do Vite só acontece na partida
AGENTE_SUITES=(unit)

# Migrations e o admin de teste rodam quando o servidor sobe, então basta o banco estar pronto.
agente_subir() {
  compose up -d --wait --wait-timeout 300 db mailpit
  # shellcheck disable=SC2086
  compose up -d --wait --wait-timeout 300 ${AGENTE_REBUILD:-} app
}

agente_portas() {
  printf '%s\n' frontend:app:5173 api:app:3001 mailpit:mailpit:8025
}

# Jest com ts-jest, sem banco. O cache de transpilação fica na worktree para sobreviver à rodada.
agente_testar_unit() {
  compose run --rm --no-deps testes sh -c \
    'exec npx jest --cacheDirectory /app/.jest-cache --forceExit "$@"' _ "$@"
}
