# Deploy

O servidor fica dentro de uma rede privada (Tailscale), sem porta de manutenção
exposta na internet. Quem entra é você, dos aparelhos autorizados, e o GitHub,
com um crachá que nasce e morre dentro de cada deploy.

Todo merge na `master` passa pelos testes e, se passarem, sobe sozinho.

- **O que sobe:** `scripts/deploy-ci.sh`, enviado ao servidor pela própria sessão
  do job `deploy` de `.github/workflows/ci.yml` e executado lá. O roteiro não
  precisa existir no servidor: o que roda é sempre a versão que está subindo.
- **O que faz:** copia o banco, traz a versão nova, reconstrói o serviço,
  espera o site responder e — se não responder — volta para a versão anterior.
- **O que ele não desfaz:** migração de banco já aplicada. Por isso a cópia sai
  antes de tudo, em `backups/pre-deploy-*.sql.gz` (as dez últimas ficam).
- **Como o job sabe que deu certo:** ele pergunta ao servidor em que versão ele
  ficou e compara com o commit que disparou o deploy. Código de saída zero não
  serve de prova — um roteiro interrompido no meio também sai com zero.

---

## Configuração inicial

A parte pesada já está feita e é da máquina, não deste projeto: a rede privada,
a política de acesso, o servidor dentro dela e o firewall fechado vieram com o
deploy do desbravadores-finance, que mora no mesmo servidor. O que falta é só o
que pertence a este repositório.

### 1. Usuário próprio no servidor

Um usuário por projeto, com o seu diretório. Não é capricho: uma mesma chave não
pode servir de chave de implantação em dois repositórios, e o GitHub recusa a
segunda.

```bash
sudo adduser --disabled-password --gecos "" deploy-iasd
sudo usermod -aG docker deploy-iasd
sudo chown -R deploy-iasd:deploy-iasd /caminho/do/repositorio
sudo chmod 600 /caminho/do/repositorio/.env.local
```

O `chown` precisa alcançar o repositório inteiro, `.git` incluído: é lá que o
roteiro grava o que baixa. A última linha fecha o arquivo de variáveis, que
guarda a senha do banco e os segredos de autenticação.

### 2. Chave de leitura para esse usuário

```bash
sudo -u deploy-iasd mkdir -p ~deploy-iasd/.ssh && sudo chmod 700 ~deploy-iasd/.ssh
sudo -u deploy-iasd ssh-keygen -t ed25519 -N "" \
  -f ~deploy-iasd/.ssh/id_ed25519 -C "deploy vps iasd"
sudo -u deploy-iasd bash -c 'ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts'
sudo -u deploy-iasd cat ~deploy-iasd/.ssh/id_ed25519.pub
```

Cole a linha impressa em **Settings › Deploy keys › Add deploy key** deste
repositório, **sem** marcar a permissão de escrita. Confira com:

```bash
sudo -u deploy-iasd git -C /caminho/do/repositorio fetch origin
```

### 3. Liberar o usuário na política da rede

No painel do Tailscale, em **Access Controls**, a regra de SSH do robô precisa
aceitar o usuário novo:

```json
{
  "action": "accept",
  "src":    ["tag:deploy-ci"],
  "dst":    ["tag:servidor"],
  "users":  ["deploy", "deploy-iasd"]
}
```

### 4. Crachá e endereço no repositório

Crie uma credencial própria em **Settings › Trust credentials › Credential ›
OAuth**, com **Write** em **Keys › Auth Keys** e a etiqueta `tag:deploy-ci`. Uma
por repositório, para poder revogar um sem derrubar o outro.

```bash
gh secret set TS_OAUTH_CLIENT_ID
gh secret set TS_OAUTH_SECRET
gh variable set DEPLOY_HOST --body "dbv-vps"
gh variable set DEPLOY_USER --body "deploy-iasd"
gh variable set DEPLOY_PATH --body "/caminho/do/repositorio"
```

**Troque o caminho de exemplo pelo caminho real** e confira com
`gh variable list` — colar a linha como está grava o texto de exemplo, e o
deploy só descobre isso ao tentar entrar numa pasta que não existe.

### 5. Ensaiar

Enquanto o roteiro não estiver na `master`, o ensaio aponta para a branch:

```bash
cd /caminho/do/repositorio
sudo -u deploy-iasd git fetch origin feat/deploy-automatizado
sudo -u deploy-iasd git checkout -B ensaio origin/feat/deploy-automatizado
sudo -u deploy-iasd bash -c 'cd /caminho/do/repositorio \
  && DEPLOY_BRANCH=feat/deploy-automatizado ./scripts/deploy-ci.sh'
sudo -u deploy-iasd git checkout master
```

Passou? Junte a branch na `master`: esse merge é o primeiro deploy automático.

---

## O dia a dia

Nada. Aprovou e mergeou, subiu. O andamento fica em **Actions**, no job
`Deploy (producao)`.

## Quando o deploy falha

O job vermelho traz o motivo e o servidor já voltou para a versão anterior. Duas
exceções aparecem em letras maiúsculas no log: **"o retorno tambem falhou"**, que
significa site fora do ar; e o caso da migração já aplicada, em que o código
voltou mas a estrutura do banco não. Para restaurar:

```bash
gunzip -c backups/pre-deploy-AAAAMMDD-HHMMSS.sql.gz \
  | docker compose exec -T db psql -U iasd iasd
```

## Emergência

Se a rede privada estiver fora do ar, o caminho é o console do painel do
provedor do VPS.

```bash
git reset --hard <commit>
docker compose up -d --build app
```
