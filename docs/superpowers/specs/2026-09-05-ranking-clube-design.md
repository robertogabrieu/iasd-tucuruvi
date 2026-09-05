# Spec — Ranking do clube: unidades, chamada e pontuação (US-31 a US-34)

- **Data:** 2026-09-05
- **Épico:** Clube de Desbravadores (novo)
- **Histórias:** US-31 a US-34, redigidas no corpo da issue deste épico (ainda não têm arquivo em `docs/historias/`)
- **Maquete:** `docs/superpowers/mockups/2026-09-05-ranking-clube.html` — **é o alvo visual**: se ela e o texto da spec divergirem, vale a maquete
- **Relacionado:** RBAC (US-10), padrão de módulo backend (`server/modules/forms/`), PR #5 (página do clube — ver §2.1)
- **Conferido em:** `1bd1307`

---

## 1. Objetivo e contexto

O Clube Antares quer um ranking de pontuação: quanto cada desbravador e cada unidade somou ao longo
da temporada. A referência que motivou a ideia é o clube Guardiões do Advento
(`clubeguardioes.com`), cujo ranking é **fechado por login** — quem não é membro é redirecionado
para a tela de acesso.

O problema desta feature **não é a tela do ranking**. É a origem dos pontos. Um ranking que exige
alguém abrir o painel e digitar presença, uniforme e pontualidade de trinta desbravadores toda
semana para de ser atualizado no segundo mês, e ranking desatualizado é pior que nenhum: o
desbravador se vê em último com dado velho e desanima.

Por isso o centro da spec é a **chamada da reunião** (§8): uma grade de marcar, feita para o celular,
na mão do conselheiro, durante a reunião. O ranking é consequência dela.

### O que esta spec não decide

Quanto vale cada critério, e se a unidade é classificada por soma ou por média, são **decisões da
diretoria do clube**, não do código. A spec entrega os dois como dado configurável e reúne no §4 o
que precisa do martelo da diretoria.

## 2. Escopo

### Dentro
- Cadastro de unidades e de membros do clube (US-31).
- Catálogo de critérios de pontuação com peso configurável, positivo ou negativo (US-32).
- Chamada da reunião: grade membros × critérios, com lançamento em massa (US-33).
- Ranking individual (no painel) e por unidade (público na página do clube) (US-34).

### Fora (YAGNI)
- Rede social interna, jogos, medalhas, feed — o que o Guardiões chama de "ecossistema".
- Classes progressivas (Amigo a Guia) e especialidades: são um cadastro grande, com regra própria, e
  não são pré-requisito do ranking.
- Área de acesso para o desbravador ou para os pais. O ranking público é anônimo por unidade (§10);
  login para menores traria cadastro de responsável, consentimento e recuperação de senha.
- App, notificação push, exportação.
- Multi-clube com seletor de clube na interface. A coluna `club_key` existe desde já (§5), mas a v1
  atende um clube.
- Correção em massa de peso lançado errado — ver limitação conhecida no §9.

### 2.1 Restrição de dependência (não é cronograma)

A seção pública do §10 entra em `src/pages/Desbravadores.tsx`. **Esse arquivo não existe em
`origin/master` no commit-base desta spec**: a página do clube está na branch `feat/desbravadores-page`,
aberta como PR #5. Enquanto essa PR não entrar, o §10 não tem onde ser implementado — o restante da
spec (§5 a §9, §13) não depende dela e pode ser feito antes. Quando e em que ordem as duas entram é
decisão de quem opera, não desta spec.

## 3. Decisões de design

1. **`club_key` é texto sem chave estrangeira, com catálogo no código.** Mesmo padrão de
   `form_submissions.form_key` (`server/migrations/007_form_submissions.sql:3-6`), que o projeto
   adotou por decisão explícita e documentada no comentário da própria migration. Quando o Clube de
   Aventureiros existir, é uma linha no catálogo, e não uma migration.

2. **O lançamento guarda os pontos, não só o critério.** `score_entries.points` é cópia do peso do
   critério no momento do lançamento. Sem isso, a diretoria mudar "Presença" de 10 para 5 em setembro
   reescreveria o ranking de março inteiro, e ninguém entenderia por que as posições se mexeram
   sozinhas.

3. **O lançamento guarda também a unidade.** `score_entries.unit_id` é a unidade do desbravador
   naquele dia. Sem isso, mover um membro de unidade em agosto levaria junto todos os pontos que ele
   fez pela unidade anterior, e duas unidades teriam o histórico alterado sem ninguém ter mexido no
   passado.

4. **Um lançamento é único por (reunião, membro, critério).** Marcar duas vezes não soma duas vezes:
   a grade é um estado, não um contador. Garantido por `UNIQUE` no banco (§5), não só na interface.

5. **A reunião é a unidade de trabalho.** Todo lançamento pertence a uma reunião com data. É o que
   permite "refazer a chamada da semana passada" sem tocar no resto e o que dá o recorte de período
   ao ranking. **Mais de uma reunião no mesmo dia é permitida** (a regular de manhã e o evento à
   noite): a data não é chave única, e a tela apenas avisa quando já existe uma reunião naquele dia.

6. **Ranking público mostra unidades; ranking individual fica no painel.** Os membros são menores de
   idade, e a página do clube é aberta e indexável. `A CONFIRMAR` com a diretoria — se decidirem
   abrir o individual, o campo `display_name` (§5) já existe para publicar "Ana C." em vez do nome
   completo.

7. **A chamada é desenhada para o celular, não para a mesa.** O conselheiro marca na reunião, de pé,
   com o telefone na mão. Se a tela só funcionar bem no desktop, o lançamento vira tarefa de casa e o
   problema descrito no §1 se realiza.

8. **Nenhum campo obrigatório além do nome, no cadastro de membro.** Data de nascimento e demais
   dados de menor são opcionais: cada campo obrigatório é uma barreira para a diretoria terminar o
   cadastro, e nenhum deles é necessário para pontuar.

## 4. Perguntas em aberto (decisão da diretoria)

Nenhuma delas bloqueia começar a implementação; todas precisam de resposta antes de a feature ir ao
ar, e a spec indica o default que fica valendo se nada for decidido.

| # | Pergunta | Default se ninguém decidir | Consequência concreta |
|---|---|---|---|
| A | Quais critérios entram e quanto vale cada um? | Catálogo vazio; a diretoria cadastra na tela da US-32 | Sem critério cadastrado, a chamada fica bloqueada (§11) |
| B | A unidade é classificada por soma ou por média de pontos por membro? | Média, com o total exibido ao lado | Na soma, a unidade com mais desbravadores ganha por tamanho, não por desempenho |
| C | O ranking individual pode ser público? | Não; só unidades no site | Se abrir, publica-se `display_name` ("Ana C."), nunca o nome completo |
| D | Quem lança a chamada: só a diretoria ou cada conselheiro na sua unidade? | Qualquer pessoa com `clube:score` lança para qualquer unidade | Restringir por unidade exige vincular usuário a unidade, o que está fora da v1 |
| E | Unidade com menos de 3 desbravadores aparece no ranking público? | Não aparece (§10) | Com 1 ou 2 membros, a "média da unidade" é o desempenho individual de uma criança, publicado |

## 5. Modelo de dados — `server/migrations/008_clube_ranking.sql`

A migration é a próxima da sequência: a última existente é `server/migrations/007_form_submissions.sql`,
e o runner aplica só as pendentes no boot (`server/core/db.ts:38-62`). `gen_random_uuid()` já está
disponível: a extensão `pgcrypto` é habilitada em `server/migrations/001_auth_foundation.sql:3`, e
`users.id` é `uuid`, o que sustenta a FK de `created_by`.

```sql
-- Unidades do clube (Falcão, Águia...). club_key sem FK: catálogo no código, como form_key.
CREATE TABLE club_units (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_key    text NOT NULL,
  name        text NOT NULL,
  color       text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_key, name)
);

-- Membros. display_name é o nome curto publicável ("Ana C."); full_name nunca sai do painel.
CREATE TABLE club_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id       uuid NOT NULL REFERENCES club_units(id) ON DELETE RESTRICT,
  full_name     text NOT NULL,
  display_name  text NOT NULL,
  birth_date    date,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_club_members_unit ON club_members (unit_id) WHERE active;

-- Critérios e pesos. points pode ser negativo (atraso, indisciplina).
CREATE TABLE score_criteria (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_key    text NOT NULL,
  label       text NOT NULL,
  points      integer NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_key, label)
);

-- Reuniões. Sem unique em (club_key, held_on): cabem duas no mesmo dia (decisão 5).
-- updated_at sustenta o controle de concorrência da chamada (§8).
CREATE TABLE club_meetings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_key    text NOT NULL,
  held_on     date NOT NULL,
  label       text,
  note        text,
  closed_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_club_meetings_date ON club_meetings (club_key, held_on DESC);

-- Lançamentos. points e unit_id são cópias do estado no dia (decisões 2 e 3).
CREATE TABLE score_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id    uuid NOT NULL REFERENCES club_meetings(id) ON DELETE CASCADE,
  member_id     uuid NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  unit_id       uuid NOT NULL REFERENCES club_units(id) ON DELETE RESTRICT,
  criterion_id  uuid NOT NULL REFERENCES score_criteria(id) ON DELETE RESTRICT,
  points        integer NOT NULL,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, member_id, criterion_id)
);
CREATE INDEX idx_score_entries_member ON score_entries (member_id);
CREATE INDEX idx_score_entries_meeting ON score_entries (meeting_id);
CREATE INDEX idx_score_entries_unit ON score_entries (unit_id);
```

**Por que `ON DELETE RESTRICT` em unidade e critério:** apagar uma unidade com membros ou um critério
já lançado apagaria história. A interface oferece **desativar** (`active = false`), que tira das telas
de lançamento e preserva o passado.

## 6. Catálogo de clubes — `server/modules/clube/clube.catalog.ts`

```ts
export const CLUBS = [
  { key: 'desbravadores', label: 'Clube de Desbravadores Antares' },
] as const
```

Espelha o padrão do catálogo de formulários (`server/modules/forms/catalog/`). Aventureiros entra como
uma linha aqui.

## 7. Backend — `server/modules/clube/`

Segue a anatomia do módulo mais recente (`server/modules/forms/`), na arquitetura em camadas
obrigatória do projeto (CLAUDE.md › Backend). Imports internos levam sufixo `.js` mesmo em arquivos
`.ts` (ESM — CLAUDE.md › Convenções).

| Arquivo | Responsabilidade |
|---|---|
| `clube.routes.ts` | Liga rotas a controller e middlewares. Duas fábricas, admin e pública, como `server/modules/forms/forms.routes.ts:19-30` |
| `clube.controller.ts` | HTTP fino: valida DTO, chama service, monta resposta |
| `clube.service.ts` | Regra de negócio: chamada, fechamento de reunião, montagem do ranking |
| `clube.repository.ts` | Único ponto com SQL |
| `clube.ranking.ts` | Funções puras de agregação, ordenação e desempate (sem SQL, sem `req`) — **é o que ganha teste jest** (§16) |
| `clube.catalog.ts` | Catálogo de clubes (§6) |
| `dto/unidade.dto.ts`, `dto/membro.dto.ts`, `dto/criterio.dto.ts` | Schemas Zod dos cadastros |
| `dto/reuniao.dto.ts` | Abertura e fechamento de reunião |
| `dto/chamada.dto.ts` | Corpo do `PUT` da chamada, incluindo a versão (§8) |
| `dto/ranking-query.dto.ts` | Filtro de período do ranking (§9) |

Instanciação no composition root (`server/container.ts`), montagem em `server/index.ts:60-74`:

```ts
app.use('/api/admin', clubeAdminRoutes)   // junto das demais rotas admin
app.use('/api/clube', clubePublicRoutes)  // pública, como /api/boletins (index.ts:74)
```

### Endpoints

| Método e rota | Permissão | O que faz |
|---|---|---|
| `GET /api/admin/clube/unidades` | `clube:manage` | Lista unidades com contagem de membros |
| `POST/PATCH /api/admin/clube/unidades/:id` | `clube:manage` | Cria/edita/desativa unidade |
| `GET /api/admin/clube/membros` | `clube:score` | Lista paginada, filtro por unidade |
| `POST/PATCH /api/admin/clube/membros/:id` | `clube:manage` | Cria/edita/desativa membro |
| `GET/POST/PATCH /api/admin/clube/criterios` | `clube:manage` | Catálogo de critérios |
| `GET /api/admin/clube/reunioes` | `clube:score` | Lista paginada de reuniões |
| `POST /api/admin/clube/reunioes` | `clube:score` | Abre uma reunião |
| `GET /api/admin/clube/reunioes/:id/chamada` | `clube:score` | Grade de uma unidade + `versao` (§8) |
| `PUT /api/admin/clube/reunioes/:id/chamada` | `clube:score` | Grava a grade daquela unidade (§8) |
| `POST /api/admin/clube/reunioes/:id/fechar` | `clube:score` | Marca `closed_at` |
| `GET /api/admin/clube/ranking` | `clube:score` | Ranking individual e por unidade, com filtro de período |
| `GET /api/clube/ranking` | pública, com rate limit | Só o ranking por unidade (§10) |

Listagens paginadas usam o contrato padrão do projeto (`server/core/pagination.ts:4,16,21`), com
`paginationQuery`, `toOffset` e `paginate`, como em `server/modules/boletins/boletins.service.ts:145-146`.
A grade da chamada e o ranking são **isentos**: vêm inteiros, porque são a tela toda.

## 8. A chamada da reunião — `PUT .../chamada`

O ponto crítico da feature. O corpo é o **estado da grade de uma unidade**, não uma lista de eventos:

```jsonc
{
  "unidadeId": "...",
  "versao": "2026-09-05T13:41:22.510Z",   // updated_at lido no GET
  "marcacoes": [
    { "membroId": "...", "criterioIds": ["...", "..."] }
  ]
}
```

O service roda dentro de `withTransaction` (`server/core/db.ts:23`, já usado por cinco módulos),
e obedece a três regras:

- **Escopo fechado pelo payload.** Só são apagados lançamentos de membros que vieram na lista. Um
  membro desativado entre carregar e salvar simplesmente não aparece no payload, e por isso **não**
  tem o histórico apagado — o erro seria tratar "não está na grade" como "foi desmarcado".
- **Concorrência otimista.** `versao` é o `updated_at` da reunião lido no `GET`. Se o banco tiver
  avançado, responde `409` com `ConflictError` (`server/core/errors.ts`) e a tela recarrega. Sem isso,
  dois conselheiros salvando em sequência fazem o segundo apagar o trabalho do primeiro em silêncio.
- **Idempotência.** Reenviar o mesmo corpo não muda nada; é o que salva a chamada quando a internet do
  salão cai no meio.

O `points` e o `unit_id` de cada lançamento vêm do critério e do membro no instante da gravação
(decisões 2 e 3). Reunião com `closed_at` preenchido recusa gravação, também com `ConflictError`.

Três razões para o estado inteiro em vez de eventos: o conselheiro corrige o que marcou errado; a rede
cai e o reenvio não pode duplicar; e o que está na tela precisa ser exatamente o que está no banco.

## 9. Cálculo do ranking — `clube.ranking.ts`

- **Individual:** soma de `score_entries.points` por membro, no período. Empate desempata pelo maior
  número de reuniões com lançamento e, persistindo, por ordem alfabética — nunca por ordem de
  inserção, que faria a posição mudar sozinha entre dois carregamentos.
- **Unidade:** agrupado por `score_entries.unit_id` (a unidade do dia, decisão 3), com total e média.
  **A média divide pelo número de membros que tiveram ao menos um lançamento no período**, e não pelo
  número de membros ativos hoje: assim, desativar alguém em outubro não muda a média de março. Empate
  desempata por total e, persistindo, por nome da unidade.
- **Unidade sem lançamento no período** aparece com traço, não com zero, para não competir por vazio.
- **Unidade desativada** continua no ranking do painel, com o histórico que fez, e sai do ranking
  público — ela não representa mais o clube para quem chega de fora.
- **Período:** default é a temporada corrente (`held_on` dentro do ano). Filtro por intervalo de datas.
- Todas as funções são puras e recebem as linhas já lidas: o cálculo é testável sem banco e o SQL fica
  no repositório, como manda a arquitetura em camadas.

**Limitação conhecida:** peso digitado errado e já lançado não tem correção em massa na v1. Como
`points` fica congelado por lançamento (decisão 2), a saída é reabrir a reunião e remarcar. Se isso se
mostrar frequente, vira issue própria — uma edição em massa mexe em história e merece desenho seu.

## 10. Página pública — seção na página do clube

Depende da PR #5 (§2.1). Nova seção em `src/pages/Desbravadores.tsx`, entre "Quem pode participar" e
"Galeria": tabela de unidades com posição, nome, média e total, na paleta `antares`, com
`SectionTitle variant="antares"`. Busca `GET /api/clube/ranking` do mesmo jeito que a página pública do
boletim busca a sua (`src/pages/BoletimPublico.tsx:20-31`): `fetch` direto no `useEffect`, sem cliente
autenticado.

Regras de privacidade do endpoint público, aplicadas no service e não na página:

- A resposta **não contém nome, data de nascimento nem identificador de membro** — só unidades e
  números.
- **Unidade com menos de 3 membros pontuados no período não entra na resposta.** Com um ou dois, a
  "média da unidade" é o desempenho individual de uma criança publicado sob outro rótulo (pergunta E
  do §4).
- A contagem de membros por unidade não é devolvida, para não permitir deduzir a pontuação individual
  a partir de total e média.
- Rate limit por IP com o utilitário do projeto (`server/lib/rate-limit.ts:11`), no mesmo formato do
  endpoint público de formulários (`server/modules/forms/forms.routes.ts:9-16`).

Enquanto não houver nenhum lançamento, a seção **não é renderizada**: uma tabela zerada no site
institucional passa a impressão de clube parado.

## 11. UX de descobribilidade

- **Pré-requisitos.** A chamada precisa de unidade, membro e critério. Sem os três, a tela mostra o que
  falta, na ordem em que precisa ser resolvido, com link para cada cadastro: "Cadastre uma unidade e ao
  menos um desbravador para fazer a chamada."
- **Vazio.** *Ranking sem lançamento:* "Nenhuma reunião lançada ainda" + botão "Fazer a chamada".
  *Unidade sem membro:* "Nenhum desbravador nesta unidade" + "Adicionar". *Filtro de período sem
  resultado:* "Nenhuma reunião neste período" + "Limpar filtro" — texto diferente do anterior, porque o
  problema é outro.
- **Bloqueio.** Reunião fechada: "Esta reunião foi fechada em <data>. Reabra para alterar a chamada."
  com o botão de reabrir ao lado, se a pessoa tiver `clube:score`. Conflito de versão: "Outra pessoa
  salvou esta chamada enquanto você preenchia. Recarregue para ver o que mudou." com o botão de
  recarregar. Critério em uso não é excluído: "Este critério já foi lançado em N reuniões. Desative
  para parar de usá-lo sem apagar a história."
- **Perfil e escopo.** Quem tem só `clube:score` faz a chamada e vê o ranking, mas não vê os botões de
  criar unidade, membro ou critério — e as mensagens de pré-requisito acima **não** oferecem link para
  o que essa pessoa não pode criar; elas dizem a quem pedir. Quem não tem nenhuma das duas permissões
  não vê o grupo "Clube" no menu.

## 12. Permissões — `server/seed/permissions.catalog.ts`

Duas linhas novas no catálogo (`server/seed/permissions.catalog.ts:2-14`), sem migration. O papel
`admin` recebe as duas no próximo boot, porque `runSeed` religa o catálogo inteiro a cada start
(`server/seed/seed.ts:8-15`, `server/modules/roles/role.repository.ts:31`).

```ts
{ key: 'clube:manage', description: 'Cadastrar unidades, membros e critérios do clube' },
{ key: 'clube:score',  description: 'Fazer a chamada e lançar pontos das reuniões' },
```

Ver o ranking no painel exige `clube:score` — quem lança é quem acompanha. Uma terceira permissão só de
leitura fica para quando existir alguém que precise ver sem lançar.

## 13. Frontend do painel

Telas em `src/painel/pages/`, compondo o kit de UI (`src/painel/ui/index.ts:3-17`) — sem Tailwind solto,
conforme `docs/patterns/area-administrativa-visual.md`:

| Rota | Tela | Componentes principais |
|---|---|---|
| `/painel/clube/unidades` | Unidades e membros | `PageHeader`, `Table`, `EmptyState`, `Modal`, `Badge` |
| `/painel/clube/criterios` | Critérios e pesos | `PageHeader`, `Table`, `Field`/`Input`, `Alert` |
| `/painel/clube/chamada` | Chamada da reunião | `PageHeader`, `Card` por unidade, `Chip` por critério, `Alert` |
| `/painel/clube/ranking` | Ranking | `PageHeader`, `FilterBar` (período), `Table`, `EmptyState` |

Chamadas à API pelo cliente do painel (`src/painel/admin-api.ts:3-4`, que instancia `makeApiClient` de
`src/auth/api-core.ts:37` — auto-refresh em 401 e CSRF nos métodos mutantes), com um
`src/painel/clube-api.ts` por domínio, como `src/painel/boletim-api.ts:1`.

Menu: grupo novo em `src/painel/nav-config.tsx:29-46`, no formato já usado pelo grupo de boletins.
**Antes**, acrescentar uma chave `clube` ao objeto de ícones `I` (`src/painel/nav-config.tsx:20-27`),
que hoje só tem `dashboard, users, settings, image, boletins, forms` — usar `I.clube` sem criá-la não
compila e derruba o `npm run build`.

```ts
{ key: 'clube', label: 'Clube', icon: icon(I.clube), perm: 'clube:score', children: [
  { label: 'Chamada',   to: '/painel/clube/chamada' },
  { label: 'Ranking',   to: '/painel/clube/ranking' },
  { label: 'Unidades',  to: '/painel/clube/unidades',  perm: 'clube:manage' },
  { label: 'Critérios', to: '/painel/clube/criterios', perm: 'clube:manage' },
] },
```

A ordem não é alfabética de propósito: chamada e ranking são semanais, cadastros são raros.

## 14. Segurança e privacidade

- Rotas admin exigem `requireAuth` + `requirePermission`, aplicados por rota como em
  `server/modules/boletins/boletins.routes.ts:15-20`.
- O endpoint público devolve **apenas agregado por unidade**, com as quatro regras do §10. Nome, data
  de nascimento e id de membro não atravessam a fronteira pública em nenhuma resposta, nem em mensagem
  de erro.
- `full_name` e `birth_date` são dados de menores: aparecem só em telas autenticadas e nunca em Open
  Graph, título de página ou URL.
- `created_by` em `score_entries` registra quem lançou, para a diretoria conseguir perguntar.

## 15. O que esta mudança NÃO quebra

- **Nada do que existe hoje toca estas tabelas.** As cinco tabelas são novas e nenhuma coluna de tabela
  existente muda; a única referência para fora é `score_entries.created_by → users(id)`, com
  `ON DELETE SET NULL` — apagar um usuário não apaga lançamento.
- **O catálogo de permissões não quebra quem já tem papel.** Permissão nova entra desligada para papéis
  que não sejam `admin`; nenhum usuário perde acesso.
- **A rota `/api/clube` é nova** e não colide com nenhuma existente: as públicas são `/api/flickr` e
  `/api/youtube` (`server/index.ts:28,45,51`), `/api/formularios` e `/api/boletins`
  (`server/index.ts:71,74`), e as administrativas ficam todas sob `/api/admin` (`server/index.ts:60-68`).
- **A suíte atual não é afetada:** os sete arquivos de `__tests__/` cobrem funções puras de formulários,
  schemas e utilitários de `lib/`, e nenhum deles toca o que esta feature cria.

## 16. Verificação

O projeto tem suíte Jest cobrindo **funções puras** (`npm test`, arquivos em `__tests__/` — CLAUDE.md ›
Convenções, linha 189); rotas, repositórios e telas são validados manualmente no browser.

**Automatizado:** `clube.ranking.ts` é exatamente o perfil coberto pela suíte e ganha teste próprio em
`__tests__/clube/ranking.test.ts`, cobrindo: soma individual, média por membro pontuado (e não por
membro ativo hoje), desempate estável nos dois rankings, unidade sem lançamento com traço, e o corte de
unidade com menos de 3 membros no recorte público.

**Manual, no navegador:**

1. Subir o servidor e confirmar no log que a migration `008` aplicou.
2. Conferir que o grupo "Clube" aparece no painel com os quatro itens.
3. Cadastrar duas unidades, três membros em cada e três critérios (um com pontos negativos).
4. Abrir a chamada de hoje, marcar critérios, salvar, recarregar e conferir que as marcações voltaram
   exatamente como estavam.
5. Desmarcar um critério, salvar, e conferir no ranking que a pontuação daquele membro caiu.
6. Mudar o peso de um critério e conferir que o ranking **não** se alterou retroativamente (decisão 2).
7. Mover um membro de unidade e conferir que os pontos que ele fez antes continuam na unidade antiga
   (decisão 3).
8. Abrir a mesma chamada em duas abas, salvar na primeira e depois na segunda: a segunda recebe o aviso
   de conflito, e nada do que a primeira gravou se perde (§8).
9. Desativar um membro no meio da temporada e conferir que a média das reuniões passadas não mudou (§9).
10. Fechar a reunião e conferir que a gravação é recusada com mensagem, e que reabrir volta a permitir.
11. Abrir `/desbravadores` numa janela anônima: conferir a tabela de unidades, que nenhum nome de membro
    aparece no HTML (`Ctrl+U`) e que uma unidade com 2 membros pontuados não aparece.
12. Criar um usuário com papel que tenha só `clube:score` e conferir que ele não vê Unidades nem
    Critérios no menu.
13. Rodar `npm run build` e conferir que passa.

## 17. Definição de pronto

- [ ] Migration `008_clube_ranking.sql` aplica no boot e cria as cinco tabelas.
- [ ] Permissões `clube:manage` e `clube:score` no catálogo, concedidas ao `admin` no boot.
- [ ] Módulo `server/modules/clube/` na arquitetura em camadas, sem SQL fora do repositório.
- [ ] Ícone `clube` acrescentado ao objeto `I` antes de referenciá-lo no menu.
- [ ] Quatro telas do painel compondo o kit de UI, com os estados vazios e bloqueios do §11.
- [ ] Chamada grava em transação, é idempotente, recusa conflito de versão e não apaga o que está fora
      do escopo do payload.
- [ ] Ranking individual no painel; ranking por unidade público, anônimo e com o corte de unidade
      pequena.
- [ ] `__tests__/clube/ranking.test.ts` verde, cobrindo os cinco casos do §16.
- [ ] Seção de ranking na página do clube (depende da PR #5), oculta enquanto não houver lançamento.
- [ ] Roteiro manual do §16 executado no navegador, desktop e mobile.
- [ ] Perguntas do §4 respondidas pela diretoria e refletidas nos cadastros.

---

## ONDE FICA

```
- runner de migrations (aplica pendentes no boot)   server/core/db.ts:38-62
- utilitário de transação                           server/core/db.ts:23
- pgcrypto / gen_random_uuid disponíveis            server/migrations/001_auth_foundation.sql:3
- última migration existente                        server/migrations/007_form_submissions.sql
- padrão de chave sem FK com catálogo no código     server/migrations/007_form_submissions.sql:3-6
- catálogo de permissões                            server/seed/permissions.catalog.ts:2-14
- admin recebe permissão nova a cada boot           server/seed/seed.ts:8-15 , server/modules/roles/role.repository.ts:31
- anatomia de módulo backend (referência)           server/modules/forms/
- fábricas de rotas admin e pública (exemplo)       server/modules/forms/forms.routes.ts:19-30
- rate limit em rota pública (exemplo)              server/lib/rate-limit.ts:11 , server/modules/forms/forms.routes.ts:9-16
- middleware de permissão por rota (exemplo)        server/modules/boletins/boletins.routes.ts:15-20
- montagem das rotas admin                          server/index.ts:60-68
- montagem das rotas públicas                       server/index.ts:28,45,51,71,74
- composition root                                  server/container.ts
- utilitário de paginação                           server/core/pagination.ts:4,16,21
- uso da paginação em service (exemplo)             server/modules/boletins/boletins.service.ts:145-146
- hierarquia de erros                               server/core/errors.ts
- kit de UI do painel                               src/painel/ui/index.ts:3-17
- ícones e menu lateral do painel                   src/painel/nav-config.tsx:20-27 , src/painel/nav-config.tsx:29-46
- cliente HTTP do painel (auto-refresh/CSRF)        src/auth/api-core.ts:37 , src/painel/admin-api.ts:3-4
- cliente por domínio (exemplo)                     src/painel/boletim-api.ts:1
- página pública buscando dados (exemplo)           src/pages/BoletimPublico.tsx:20-31
- convenção de testes (funções puras, jest)         CLAUDE.md:189 , package.json:9 , __tests__/
- página do clube (NÃO existe em master; PR #5)     src/pages/Desbravadores.tsx na branch feat/desbravadores-page
- conferido em                                      1bd1307
```
