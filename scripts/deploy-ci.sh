#!/bin/bash
set -euo pipefail

# Deploy nao interativo, chamado pelo GitHub por dentro da rede privada.
#
# O update.sh e irmao deste e continua valendo para quem esta digitando: ele
# pergunta pela URL publica quando ela falta, porque tem alguem do outro lado
# para responder. Aqui nao ha ninguem, entao as tres diferencas sao: nada
# pergunta, nenhum erro e engolido, e o que sobe quebrado volta sozinho.

BRANCH="${DEPLOY_BRANCH:-master}"
ESPERA_SAUDE="${ESPERA_SAUDE:-180}"
BACKUPS_MANTIDOS=10
COMPOSE=(docker compose -f docker-compose.yml)

log() { printf '[%s] %s\n' "$(date -u '+%H:%M:%S')" "$*"; }
fim_com_erro() { printf '[%s] ERRO: %s\n' "$(date -u '+%H:%M:%S')" "$*" >&2; exit 1; }

[ -f docker-compose.yml ] || fim_com_erro "rode na raiz do repositorio"
[ -f .env.local ] || fim_com_erro ".env.local nao encontrado — rode ./deploy.sh uma vez antes"

# Lido linha a linha em vez de executado: o arquivo de variaveis e escrito a
# mao e um valor com espaco ou aspas soltas derrubaria o deploy inteiro.
ler_env() { grep -E "^${1}=" .env.local | tail -1 | cut -d= -f2-; }
PORT="$(ler_env PORT)"; PORT="${PORT:-3001}"
DB_USER="$(ler_env POSTGRES_USER)"; DB_USER="${DB_USER:-iasd}"
DB_NAME="$(ler_env POSTGRES_DB)"; DB_NAME="${DB_NAME:-iasd}"

# O servidor so passa a escutar depois de aplicar as migracoes e o seed — o
# bootstrap derruba o processo se qualquer uma falhar. Por isso a raiz serve de
# sinal de vida sem rota dedicada: se responde, o banco esta de pe e atualizado.
aguardar_saude() {
  local limite="$1" i=0
  while [ "$i" -lt "$limite" ]; do
    if curl -fsS -o /dev/null --max-time 5 "http://127.0.0.1:${PORT}/"; then
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  return 1
}

ANTES="$(git rev-parse HEAD)"
log "versao no ar: ${ANTES:0:8}"

ALTERACOES_LOCAIS="$(git status --porcelain)"
if [ -n "$ALTERACOES_LOCAIS" ]; then
  log "alteracoes feitas a mao no servidor serao descartadas:"
  printf '%s\n' "$ALTERACOES_LOCAIS"
fi

log "buscando $BRANCH no GitHub"
git fetch --prune origin "$BRANCH"
DEPOIS="$(git rev-parse "origin/${BRANCH}")"

if [ "$ANTES" = "$DEPOIS" ] && [ -z "$ALTERACOES_LOCAIS" ]; then
  log "ja esta na versao mais recente"
  exit 0
fi

MUDOU="$(git diff --name-only "$ANTES" "$DEPOIS")"
if ! grep -qvE '^(docs/|[^/]*\.md$)' <<<"$MUDOU"; then
  log "so documentacao mudou; atualizando o codigo sem reconstruir"
  git reset --hard "$DEPOIS"
  echo "$DEPOIS" >.deployed-commit
  exit 0
fi

log "garantindo o banco de pe"
"${COMPOSE[@]}" up -d db
for i in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T db pg_isready -U "$DB_USER" -d "$DB_NAME" </dev/null >/dev/null 2>&1; then break; fi
  [ "$i" -eq 30 ] && fim_com_erro "o banco nao respondeu em 30s"
  sleep 1
done

# Tirada antes de qualquer coisa porque e o unico passo que o retorno
# automatico nao cobre: voltar o codigo nao desfaz migracao ja aplicada.
#
# O `</dev/null` aqui e no pg_isready acima nao e decorativo: `exec -T`
# encaminha a entrada padrao para dentro do container, e um roteiro que esteja
# sendo lido de uma entrada padrao acabaria engolindo o proprio resto.
mkdir -p backups
COPIA="backups/pre-deploy-$(date -u '+%Y%m%d-%H%M%S').sql.gz"
log "copia do banco em $COPIA"
"${COMPOSE[@]}" exec -T db pg_dump -U "$DB_USER" "$DB_NAME" </dev/null | gzip >"$COPIA"
ls -1t backups/pre-deploy-*.sql.gz | tail -n "+$((BACKUPS_MANTIDOS + 1))" | xargs -r rm -f

log "aplicando ${DEPOIS:0:8}"
git log --oneline "$ANTES".."$DEPOIS" || true
git reset --hard "$DEPOIS"

if ! "${COMPOSE[@]}" up -d --build app; then
  log "a construcao falhou; voltando para ${ANTES:0:8}"
  git reset --hard "$ANTES"
  "${COMPOSE[@]}" up -d --build app || fim_com_erro "o retorno tambem falhou — o site precisa de socorro manual"
  fim_com_erro "versao nova nao construiu; o servidor esta na versao anterior"
fi

log "esperando o site responder (ate ${ESPERA_SAUDE}s)"
if aguardar_saude "$ESPERA_SAUDE"; then
  echo "$DEPOIS" >.deployed-commit
  log "no ar: ${DEPOIS:0:8}"
  exit 0
fi

log "o site nao respondeu; voltando para ${ANTES:0:8}"
"${COMPOSE[@]}" logs --tail 40 app || true
git reset --hard "$ANTES"
"${COMPOSE[@]}" up -d --build app || fim_com_erro "o retorno tambem falhou — o site precisa de socorro manual"
if aguardar_saude 120; then
  fim_com_erro "versao nova subiu quebrada; o servidor voltou para a anterior. Banco em $COPIA"
fi
fim_com_erro "o site nao responde nem na versao anterior — socorro manual. Banco em $COPIA"
