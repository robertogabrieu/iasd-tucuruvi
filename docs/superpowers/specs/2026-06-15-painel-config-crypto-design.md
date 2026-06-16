# Spec — Painel administrativo: shell, configurações de e-mail e criptografia de segredos

**Data:** 2026-06-15 · **Branch:** `feat/area-administrativa`
**Histórias cobertas:** US-13 (menu lateral colapsável), US-14 (tela de configurações — e-mail), US-15 (criptografia de segredos de configuração).
**Superfície nova:** `/api/admin/settings/*` (backend) + `core/security/crypto.service.ts` + módulo `settings` + shell `/painel/*` e tela de Configurações (frontend).

## Contexto

Os épicos anteriores entregaram a fundação de **Autenticação** (`001_auth_foundation.sql`, `core/security`
com `Password`/`TokenService`/`csrf`, `requireAuth`, `requireCsrf`, cookies, telas mínimas) e de
**Gestão de Usuários + RBAC** (`002_user_management.sql`, `requirePermission`, módulos `invitations`/`roles`/`authz`,
aceite público de convite). Esta spec constrói **em cima dessa fundação** a primeira interface real do painel
(shell navegável), a primeira tela de configuração de sistema (e-mail) e o mecanismo transversal de criptografia
reversível que protege os segredos dessa configuração.

Estado relevante no início (verificado no código):

- **Rotas autenticadas hoje:** `/login`, `/esqueci-senha`, `/redefinir-senha`, `/aceitar-convite` (públicas) e
  `/painel` (`src/pages/Painel.tsx`, placeholder protegido por `ProtectedRoute`). **Não existe shell de painel.**
- **Frontend de API:** `src/auth/auth-api.ts` fixa o prefixo `/api/auth` e centraliza CSRF (`ensureCsrf`) e
  auto-refresh (`tryRefresh`/`apiFetch`). **Não há cliente para `/api/admin`.** O `AuthContext` expõe
  `user`/`login`/`logout`; `GET /me` devolve `{ id, name, email, roles }` (sem `permissions`).
- **E-mail:** `server/lib/mail.ts` cria um `transporter` Nodemailer **singleton, lido do env no import** (`SMTP_*`).
  `server/mail/auth-mail.ts` (`sendPasswordResetEmail`, `sendInvitationEmail`) e `index.ts` (`sendContatoEmail`)
  consomem esse transporter. Em dev aponta para o Mailpit (`localhost:1025`).
- **RBAC:** `requirePermission('chave')` existe e funciona por **permissão** (não por nome de role). O catálogo
  `server/seed/permissions.catalog.ts` tem `users:read`, `users:invite`, `roles:assign`, `boletim:write` — **não tem**
  `settings:manage`. O seed concede **todas** as permissões do catálogo à role `admin` (idempotente, sem migration ao
  adicionar chave).
- **Banco / migrations:** runner caseiro em `core/db.ts` aplica `migrations/*.sql` em ordem alfabética, idempotente via
  `schema_migrations`; já existem `001` e `002` (próxima é `003`). `withTransaction` disponível. `config.ts` lê/valida env.
- **Segredos / deploy:** `deploy.sh` gera segredos com `gen_secret() { openssl rand -hex N; }`; `.env.example` documenta
  cada variável. `core/security/` já hospeda `password.ts`, `token.service.ts`, `csrf.ts`.

## Decisões tomadas no brainstorming

| Tema | Decisão |
|---|---|
| Divisão das specs | **Spec única** cobrindo US-13 + US-14 + US-15 (US-14 depende de ambas). |
| Rotas do painel | **Manter `/painel/*`** (shell + filhos). Não migrar para `/admin/*`; não mexer em rotas/cookies de auth já validados. "Painel" já é o termo usado nos e-mails. |
| Storage de configuração | **Tabela `settings` genérica chave→valor** (reutilizável por futuras abas de config), não uma `email_settings` dedicada. |
| Envelope de segredo | Segregado: qualquer segredo reversível é uma **linha própria** cujo `value` jsonb é um `EncryptedValue`. Mantém o crypto desacoplado da feature (US-15 CA-05). |
| Transporter de e-mail | **Construído dinamicamente** a partir da config vigente (banco→env) a cada envio. Site de baixíssimo volume: simplicidade > cache. |

Todo o código novo segue a arquitetura em camadas obrigatória do `CLAUDE.md`
(`routes → controller → service → repository → db`, organização por módulo, 4 design patterns:
Repository, Service Layer, DI por construtor no `container.ts`, hierarquia de erros + handler central).
Uma classe só nasce com estado + comportamento coeso e mais de um consumidor; caso contrário, função pura.

---

## Parte A — Criptografia de segredos (US-15)

Fundação transversal; é o primeiro item porque US-14 depende dela.

### A.1 Serviço de cifragem — `core/security/crypto.service.ts`

AES-256-GCM nativo do Node (`node:crypto`), **sem dependência nova**. Interface reutilizável e desacoplada de
qualquer feature (US-15 CA-05):

```ts
export interface EncryptedValue {
  ciphertext: string   // base64
  iv: string           // base64 (12 bytes, nonce GCM)
  authTag: string      // base64 (16 bytes)
  keyVersion: number   // 1 hoje; habilita rotação (CA-06)
}

export class CryptoService {
  constructor(private readonly key: Buffer, private readonly keyVersion = 1) {}
  encrypt(plaintext: string): EncryptedValue
  decrypt(value: EncryptedValue): string   // valida authTag; adulteração ⇒ erro claro
}
```

- **É uma classe** (não função pura) porque carrega **estado** — a chave + a versão de chave — e terá **mais de um
  consumidor** (o módulo `settings` agora, futuros segredos depois). Coerente com a regra anti-complexidade do `CLAUDE.md`.
- `encrypt`: gera `iv` aleatório (12 bytes), cifra com `aes-256-gcm`, devolve o envelope com `keyVersion`. O texto claro
  **nunca** é persistido (CA-01).
- `decrypt`: reconstrói o cipher com o `iv`, seta o `authTag` e decifra. Falha de verificação do GCM (conteúdo
  adulterado no banco) lança um erro de domínio claro — **nenhum dado corrompido é usado silenciosamente** (CA-03).
- **Chave fora do banco (CA-02):** `config.ts` lê `CONFIG_ENCRYPTION_KEY` (32 bytes; aceita hex de 64 chars ou base64),
  valida o tamanho no boot e falha cedo em produção se ausente/curta. A chave não é versionada nem gravada no banco.

### A.2 Rotação de chave (CA-06)

- `keyVersion` viaja **dentro** do envelope, então registros cifrados com chaves diferentes coexistem.
- Script `scripts/rotate-config-key.ts` (rodável via npm script, ex. `npm run rotate:config-key`): lê
  `CONFIG_ENCRYPTION_KEY_OLD` (atual) e `CONFIG_ENCRYPTION_KEY` (nova), varre as linhas de `settings` cujo `value` é um
  `EncryptedValue`, **decifra com a antiga e recifra com a nova** (incrementando `keyVersion`), numa transação.
  Procedimento documentado no `.env.example` e no `README`/comentário do script. Hoje só existe `v1`.

### A.3 Não-exposição (CA-04)

- O valor decifrado **nunca** é retornado pela API nem registrado em log. A API de configuração expõe apenas um flag
  `hasPassword: boolean` (ver Parte B), nunca o segredo. Na UI o campo é **somente-escrita**.
- Erros de decifragem logam contexto mínimo (qual chave/linha falhou), **nunca** o conteúdo.

### A.4 deploy.sh / .env.example

- `deploy.sh`: gerar `CONFIG_ENCRYPTION_KEY="$(gen_secret 32)"` e gravá-la no `.env` junto dos demais segredos.
- `.env.example`: documentar `CONFIG_ENCRYPTION_KEY` (32 bytes, `openssl rand -hex 32`) e `CONFIG_ENCRYPTION_KEY_OLD`
  (vazia; usada só durante rotação).

---

## Parte B — Configurações de e-mail (US-14)

### B.1 Modelo de dados — migration `003_settings.sql`

```sql
CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);
```

Config de e-mail em **duas linhas**, separando texto claro de segredo:

| key | value (jsonb) |
|---|---|
| `email` | `{ host, port, from, to, secure, authUser }` — metadados não sensíveis, texto plano |
| `email.smtp_password` | `EncryptedValue` (`{ ciphertext, iv, authTag, keyVersion }`) — cifrado (US-15) |

Manter o segredo numa linha própria garante que o `GET` da config (que lê só `email`) jamais toque no segredo e
simplifica a regra de "nunca retornar a senha".

### B.2 Catálogo de permissões

Adicionar a `server/seed/permissions.catalog.ts`:
`{ key: 'settings:manage', description: 'Gerenciar configurações do sistema' }`. **Sem migration** — o seed popula a
nova chave e a vincula à role `admin` (idempotente) no próximo boot.

### B.3 Transporter dinâmico — `server/lib/mail.ts`

- Substituir o `transporter` singleton estático por uma função `getTransporter()` que **lê a config vigente**
  (precedência **banco → env**) e constrói um `nodemailer.createTransport` na hora. A senha vem decifrada via
  `CryptoService` apenas no momento do envio, em memória.
- Como `mail.ts` (camada `lib/`) não deve conter regra de negócio nem falar com o repo de settings diretamente, a
  resolução da config + decifragem fica no `SettingsService`, que **injeta** a config resolvida no envio. Forma
  concreta: `mail.ts` expõe `sendMail(resolvedConfig, message)` (helper fino que monta o transporter a partir de uma
  config já resolvida); `auth-mail.ts` e o handler de `/api/contato` passam a obter a config via o `SettingsService`
  (ou um `getEmailConfig()` exportado do container) antes de enviar. **Sem** transporter estático remanescente.
  Detalhe de fiação fica para o plano; o desenho exige: (a) nenhuma config de e-mail lida só do env quando há valor no
  banco; (b) a senha decifrada nunca sai da camada de serviço.
- Efeito colateral desejado: e-mails de **reset** (US-04) e **convite** (US-06) passam a respeitar a config do painel
  automaticamente, sem redeploy (US-14 CA-03).

### B.4 Módulo `settings` (camadas do CLAUDE.md)

```
server/modules/settings/
├── settings.repository.ts        # get(key) / upsert(key, value, updatedBy) na tabela settings
├── settings.service.ts           # regra: merge banco→env, cifra/decifra senha, monta config p/ envio, e-mail de teste
├── settings.controller.ts        # HTTP fino
├── settings.routes.ts            # liga rotas → controller + requireAuth + requirePermission + requireCsrf
└── dto/email-settings.dto.ts     # schemas Zod de entrada/saída
```

- **`SettingsRepository`**: `get(key): Promise<unknown | null>` · `upsert(key, value, updatedBy?, tx?)`
  (`INSERT ... ON CONFLICT (key) DO UPDATE`). Único ponto de SQL.
- **`SettingsService`** (injeta `SettingsRepository` + `CryptoService`):
  - `getEmailConfig(): ResolvedEmailConfig` — lê a linha `email`, faz **merge com fallback env** (`SMTP_*`) campo a
    campo, e anexa `hasPassword` (true se existe a linha `email.smtp_password` **ou** `SMTP_PASS` no env). **Nunca**
    devolve a senha. Reutilizado pelo `GET` e como fonte do envio real.
  - `getResolvedConfigForSending()` — como acima, porém **decifra** a senha (uso interno do envio; nunca exposto).
  - `updateEmailConfig(dto, updatedBy)` — valida; `upsert('email', {...})`; **se** `dto.password` veio preenchida,
    cifra com `CryptoService.encrypt` e `upsert('email.smtp_password', envelope)`; **se em branco, não toca** na linha do
    segredo (preserva — CA-06). Vale sem restart (CA-03).
  - `sendTestEmail(to)` — usa a config resolvida (com senha decifrada) para disparar um e-mail de teste; devolve
    `{ ok: true }` ou `{ ok: false, reason }` com o motivo quando o SMTP falha (CA-05). Em dev cai no Mailpit.
- **Endpoints** (base `/api/admin/settings`, todos `requireAuth` + `requirePermission('settings:manage')`; mutações com
  `requireCsrf`):

  | Método | Rota | História | Resumo |
  |---|---|---|---|
  | GET | `/email` | US-14 CA-02 | config vigente (banco→env) + `hasPassword`; **nunca** a senha |
  | PUT | `/email` | US-14 CA-03/04/06 | valida; cifra senha só se enviada; em branco preserva; grava sem restart |
  | POST | `/email/test` | US-14 CA-05 | dispara teste com a config atual; retorna sucesso/falha + motivo |

- **DTOs Zod** (`dto/email-settings.dto.ts`, espelhados no client — convenção do projeto):
  - entrada `PUT`: `{ host: string, port: number(int, 1..65535), from: email, to: email, secure: boolean,
    authUser: string optional, password: string optional }` (porta não numérica / e-mail malformado ⇒ erro por campo,
    nada gravado — CA-04).
  - saída `GET`: mesma forma **sem** `password`, **com** `hasPassword: boolean`.
  - `POST /email/test`: `{ to: email }`.

### B.5 Composition root e índice

`container.ts`: instancia `CryptoService(config.configEncryptionKey)`, `SettingsRepository(pool)`,
`SettingsService(settingsRepo, crypto, ...)` → exporta `settingsRoutes = makeSettingsRoutes(controller, requireAuth,
requirePermission)`. Exporta também um `getEmailConfig()` (ou expõe o `settingsService`) para o `auth-mail`/`contato`
resolverem a config no envio. `index.ts`: `app.use('/api/admin', settingsRoutes)`.

---

## Parte C — Frontend: shell do painel (US-13) + tela de Configurações (US-14)

### C.1 Shell `/painel/*` (US-13)

`/painel` deixa de ser página solta e vira **layout com `<Outlet/>`** e sidebar, isolado do site público (sem
`Header`/`Footer` institucional).

```
src/painel/
├── PainelLayout.tsx          # <Sidebar/> + <main><Outlet/></main>
├── Sidebar.tsx               # UI do menu (apresentação)
├── nav-config.tsx            # estrutura de navegação (dados, separada da UI) + ícones SVG inline
├── usePersistentState.ts     # hook genérico state ↔ localStorage
└── pages/
    ├── Dashboard.tsx         # placeholder (conteúdo real em épico futuro)
    └── Configuracoes.tsx     # US-14
```

- **`App.tsx`:** rota `/painel` protegida (`ProtectedRoute` reaproveitado) renderizando `PainelLayout`, com rotas
  filhas: `index` → `Dashboard`; `configuracoes` → `Configuracoes`; demais itens de menu (Conteúdo/Usuários) como
  **stubs "em breve"** (os épicos deles não estão nesta entrega).
- **`nav-config.tsx`** — fonte única da estrutura (US-13 CA-08): **Dashboard**; **Conteúdo** (Sermões, Galeria,
  Departamentos); **Usuários** (Lista, Convites, Papéis); **Configurações**; **Sair** no rodapé. Ícones **SVG inline**
  (sem dependência nova). Itens sem página pronta apontam para stubs.
- **`usePersistentState<T>(key, initial)`** — hook reutilizável que sincroniza estado ↔ `localStorage`. Instâncias:
  `admin.sidebar.collapsed` (boolean) e `admin.sidebar.openGroups` (lista de chaves) — persistem entre navegação e
  reload (US-13 CA-03/CA-04).
- **`Sidebar.tsx`** — comportamentos mapeados aos CA:
  - **CA-01** logo fixo no topo: expandido = logo + nome do site; trilho = só logo.
  - **CA-02** botão colapsar → **trilho estreito de ícones**; transição suave (CSS transition em `width`); expandir
    traz os rótulos de volta.
  - **CA-04** submenus colapsáveis com **chevron** refletindo o estado; conjunto aberto persiste.
  - **CA-05** no modo trilho, **hover** em item com subitens → **flyout** lateral, sem expandir o menu inteiro.
  - **CA-06** item ativo destacado via `NavLink` (`isActive`). Paleta `iasd-dark`/`iasd-accent` (Tailwind).
  - **CA-07** **botão Sair fixo no rodapé**, sempre visível (fora da rolagem da lista) → `logout()` do `AuthContext`
    (US-02) + redireciona para `/login`.
- Logo: usar o asset existente em `/public/img/` (a nota da US-13 cita `/img/logo-iasd.svg`; se só houver o `.png`
  atual, usar o disponível — o plano confirma o arquivo).

### C.2 Cliente de API admin

`auth-api.ts` fixa `/api/auth`; as configurações vivem em `/api/admin`. **Generalizar** a lógica de CSRF + auto-refresh
num helper base e expor `src/painel/admin-api.ts` (prefixo `/api/admin`) reaproveitando `ensureCsrf`/`tryRefresh` —
**sem duplicar** a lógica. `auth-api.ts` continua atendendo `/api/auth`.

### C.3 Tela de Configurações (US-14) — `pages/Configuracoes.tsx`

- **Abas verticais** como componente reutilizável (`VerticalTabs`), preparado para crescer; hoje só a aba **E-mail**,
  ativa e selecionada por padrão (CA-01); estrutura comporta novas abas sem rever o layout.
- Formulário (React Hook Form + Zod) carrega via `GET /api/admin/settings/email` (admin-api). Campo de **senha SMTP**
  sempre **em branco**, com indicação "já existe um valor salvo" quando `hasPassword` (CA-02); tratado como
  **somente-escrita** (alinha US-15 CA-04).
- Salva via `PUT`; validação **por campo** (CA-04); senha em branco preserva a anterior (CA-06).
- **"Enviar teste"**: campo de destinatário → `POST /email/test`; exibe **sucesso** ou **falha com motivo** (CA-05);
  em dev confirma no Mailpit.
- Schema Zod **duplicado** client/server em sincronia (`src/schemas/` ↔ `server/.../dto/`) — convenção do projeto.
- **Autorização:** o backend é a fonte de verdade do `403` (`settings:manage`, CA-07). A tela não precisa esconder-se
  proativamente. *Incremento futuro (fora de escopo):* expor `permissions` no `GET /me` para ocultar itens de menu sem
  permissão.

---

## Fluxo de dados e mapeamento de erros

| Situação | Status | Erro |
|---|---|---|
| Sem `access_token` válido em `/api/admin/settings/*` | 401 | `UnauthorizedError` (via `requireAuth`) |
| Autenticado sem `settings:manage` | 403 | `ForbiddenError` (via `requirePermission`) — US-14 CA-07 |
| `PUT /email` com campo inválido (porta/e-mail) | 422 | `ValidationError` (Zod) — US-14 CA-04 |
| Decifragem com `auth_tag` inválido (registro adulterado) | 500 | erro de domínio do `CryptoService` — US-15 CA-03 (nunca usa dado corrompido) |
| `POST /email/test` com SMTP falhando | 200 | corpo `{ ok: false, reason }` (falha de envio não é erro HTTP) — US-14 CA-05 |

Todos os `AppError` traduzidos pelo handler central existente (`core/error-handler.ts`). Nenhum `try/catch` nos
controllers.

## Segurança

- **Segredo SMTP cifrado em repouso** (AES-256-GCM) com `auth_tag` verificado; chave fora do banco
  (`CONFIG_ENCRYPTION_KEY`), gerada pelo `deploy.sh`, nunca versionada. Texto claro nunca persistido/logado/retornado.
- Senha **somente-escrita** na API e na UI; `GET` expõe só `hasPassword`.
- `requirePermission('settings:manage')` em todas as rotas de config; `requireCsrf` nas mutações; reaproveita o modelo
  de sessão/cookies existente (sem mudança).
- Rotação de chave documentada (script dedicado), sem downtime do schema.
- Defesa em profundidade (registro, fora do escopo de código): `db` sem porta exposta, usuário de banco com menor
  privilégio, TLS quando o banco for remoto, backups cifrados.

## Config (novas variáveis)

| Variável | Uso | Default/dev |
|---|---|---|
| `CONFIG_ENCRYPTION_KEY` | chave AES-256-GCM (32 bytes) | obrigatória em prod; dev pode usar valor fixo de teste |
| `CONFIG_ENCRYPTION_KEY_OLD` | chave anterior, só durante rotação | vazia |

`SMTP_*` permanecem como **fallback inicial** (US-14 CA-03) até existir config no banco.

## Validação (sem suíte de testes — convenção do projeto)

Validação manual no browser + `curl` + Mailpit + inspeção no Postgres:

1. **US-15:** salvar uma senha SMTP → conferir na tabela `settings` que `email.smtp_password` está **cifrada**
   (`ciphertext`/`iv`/`authTag`/`keyVersion`), texto claro ausente. Adulterar o `ciphertext` no banco → próximo envio
   falha com erro claro (auth tag). Rodar `npm run rotate:config-key` com chave nova → registros recifrados, envio segue
   funcionando.
2. **US-14:** `GET /email` preenche o form com config vigente (banco→env), senha em branco com aviso de valor salvo.
   `PUT` com porta não numérica / e-mail malformado ⇒ `422` por campo, nada gravado. Salvar host/porta novos passa a
   valer **sem restart**. Salvar com senha em branco **preserva** a anterior. "Enviar teste" cai no Mailpit; SMTP
   inválido retorna falha com motivo. Sem `settings:manage` ⇒ `403`.
3. **US-13:** colapsar/expandir o menu (trilho de ícones com transição); recarregar a página mantém o estado;
   submenus abertos persistem; flyout aparece no modo trilho ao passar o mouse; item ativo destacado na rota atual;
   botão Sair no rodapé desloga e leva ao `/login`.

## Fora de escopo (incrementos futuros)

- Páginas reais de Conteúdo (Sermões/Galeria/Departamentos) e Usuários (Lista/Convites/Papéis) — itens de menu ficam
  como stubs nesta entrega; cada um é épico próprio.
- Novas abas de Configurações (segurança, integrações, aparência) — o layout de abas já comporta, mas só a aba E-mail
  é entregue.
- Expor `permissions` no `GET /me` para ocultar itens de menu sem permissão.
- Cache do transporter / config de e-mail — só se houver necessidade de performance (volume é baixo).
