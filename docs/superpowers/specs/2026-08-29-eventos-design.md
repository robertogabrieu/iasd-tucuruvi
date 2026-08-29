# Eventos — cadastro, capa gerada e página pública

**Issue:** [#19](https://github.com/robertogabrieu/iasd-tucuruvi/issues/19) · **História:** `docs/historias/US-29-eventos.md` · **Branch:** `feature/issue-19-eventos`

**Mockup aprovado:** `docs/superpowers/specs/2026-08-29-eventos-mockup.html` (abrir no navegador).
**Em caso de divergência entre esta spec e o mockup, o mockup vence** — ele é o que foi aprovado olhando.
Do mockup se copia **estrutura e decisão**, nunca CSS: ele carrega Tailwind próprio, e as classes reais
saem dos componentes nomeados em §8.1.

---

## 1. O que esta spec decide

A US-29 deixou quatro decisões em aberto (`docs/historias/US-29-eventos.md`, seção "Decisões em aberto").
Esta spec fecha as quatro:

| # | Decisão da US-29 | Resolução |
|---|---|---|
| 1 | Conjunto exato de campos fixos | Definido em §3. Entram `summary` (chamada) e o bloco de responsável; sai `organizer` como texto livre, substituído por `category` + responsável. |
| 2 | Listagem pública `/eventos` e/ou seção na home | `/eventos` **entra no v1**. Seção na home **fica fora**. |
| 3 | Eventos recorrentes | **Fora do v1.** Evento recorrente vira um cadastro por ocorrência. |
| 4 | Nomenclatura das permissões | **`evento:write` / `evento:publish`** (singular), pelo paralelo direto com `boletim:write` / `boletim:publish` (`server/seed/permissions.catalog.ts:8-9`). |

E acrescenta o que motivou a demanda e não estava na US-29: **remoção de fundo da foto do responsável
no navegador** e **geração automática das imagens de compartilhamento**.

---

## 2. Escopo

**Entra**

- Módulo administrativo de eventos: lista, formulário, publicar/despublicar, excluir.
- Capa em dois modos: **foto do responsável com fundo removido** (montada em três estilos) ou **arte pronta** enviada pelo usuário.
- Página pública `/eventos/:slug` e listagem pública `/eventos`.
- Imagem de compartilhamento 1200×630 (preview do link) e 1080×1920 (Stories), geradas no servidor.
- Botões de compartilhar: copiar link, WhatsApp, e a arte vertical via lista de aplicativos do celular.
- Open Graph injetado no servidor em produção, no mesmo lugar onde já é feito para o boletim.

**Não entra**

- Seção "Próximos eventos" na home.
- Eventos recorrentes.
- Inscrição de participantes dentro do site (o campo de ação é um link externo).
- Edição da arte pelo usuário (recortar, mover, trocar cor).
- Envio de e-mail ou notificação sobre eventos.
- Postagem direta no Instagram — ver §6.3, é impossível sem conta comercial e app aprovado pela Meta.

---

## 3. Modelo de dados

Migration nova `server/migrations/007_eventos.sql`. As migrations rodam no boot
(`server/core/db.ts:42`), lendo o diretório resolvido em `server/core/db.ts:40`.

```sql
CREATE TABLE eventos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text NOT NULL,
  summary             text,
  description         jsonb NOT NULL DEFAULT '{}'::jsonb,
  category            text,
  starts_at           timestamptz NOT NULL,
  ends_at             timestamptz,
  location_name       text NOT NULL,
  location_address    text,
  cover_mode          text NOT NULL DEFAULT 'foto' CHECK (cover_mode IN ('foto', 'arte')),
  cover_style         text NOT NULL DEFAULT 'classico' CHECK (cover_style IN ('classico', 'vibrante', 'sobrio')),
  host_name           text,
  host_role           text,
  host_photo_media_id uuid REFERENCES media(id) ON DELETE SET NULL,
  art_media_id        uuid REFERENCES media(id) ON DELETE SET NULL,
  cta_label           text,
  cta_url             text,
  status              text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  slug                text,
  published_at        timestamptz,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_eventos_slug ON eventos (slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_eventos_status_starts ON eventos (status, starts_at);
CREATE INDEX idx_eventos_created_at ON eventos (created_at DESC);
```

Colunas fixas, não JSONB de blocos: os campos são estruturados e a listagem precisa **ordenar e
filtrar por `starts_at`**, o que um documento JSON não entrega bem. É a diferença explícita em
relação ao boletim, cujo conteúdo é `content jsonb` (`server/migrations/005_boletins.sql:8`).

O índice único parcial de slug copia o do boletim (`server/migrations/005_boletins.sql:18`):
rascunho tem `slug` nulo e não colide.

**`description` é um documento TipTap**, o mesmo formato do bloco de texto do boletim
(`src/schemas/boletim.ts`, tipo `TipTapDoc`), para reaproveitar editor e renderizador sem
dependência nova.

**`category` é uma lista fechada em código**, não uma tabela: `Culto especial`, `Jovens`,
`Desbravadores`, `Aventureiros`, `Música`, `Mulheres`, `Comunicação`, `Outro`. Uma constante
exportada, consumida pelo `<Select>` do formulário e validada no DTO. Vira tabela no dia em que
alguém precisar criar categoria pela interface — não antes.

**Datas** são `timestamptz`. A exibição usa `America/São_Paulo` — o servidor guarda o instante,
a formatação é do cliente.

### 3.1 Campos obrigatórios e regras

| Regra | Quando vale |
|---|---|
| `title`, `description` não vazia, `starts_at`, `location_name` obrigatórios | sempre (CA-01 da US-29) |
| `ends_at` posterior a `starts_at` | quando `ends_at` existe (CA-02) |
| `cover_mode = 'foto'` exige `host_photo_media_id`, `host_name`, `host_role` | só para **publicar** |
| `cover_mode = 'arte'` exige `art_media_id` | só para **publicar** |
| `cta_url` exige `cta_label`, e vice-versa | quando qualquer um dos dois existe |
| `cta_url` precisa ser `http`/`https` | quando existe |

Rascunho aceita estar incompleto; a validação da capa e do restante só barra **na publicação**.
Isso é deliberado: quem preenche pela metade e volta depois não pode perder o que digitou.

---

## 4. Permissões

Duas linhas novas em `server/seed/permissions.catalog.ts` (hoje com 10 permissões, linhas 3-12):

```ts
{ key: 'evento:write',   description: 'Criar/editar eventos' },
{ key: 'evento:publish', description: 'Publicar/despublicar eventos' },
```

**Sem migration.** O catálogo é versionado em código e o seed religa todas as permissões ao papel
`admin` a cada boot — comportamento descrito em `CLAUDE.md` › RBAC e implementado em
`server/seed/seed.ts`. Para aplicar sem reiniciar: `npm run grant:admin-permissions`.

**Armadilha de permissão, resolvida:** o upload da biblioteca de mídia exige `media:manage`
(`server/modules/media/media.routes.ts:40`). Um líder com `evento:write` e sem `media:manage`
não conseguiria enviar a foto. Por isso o upload da foto e da arte do evento passa por **rota
própria do módulo de eventos**, protegida por `evento:write`, que chama o mesmo `MediaService`.
A biblioteca de mídia continua exigindo `media:manage` para gerenciar o acervo.

---

## 5. Backend

Módulo novo `server/modules/eventos/`, na arquitetura em camadas obrigatória do projeto
(`CLAUDE.md` › "Arquitetura em camadas"): `eventos.routes.ts` → `eventos.controller.ts` →
`eventos.service.ts` → `eventos.repository.ts`, mais `dto/evento.dto.ts`. Montagem no
composition root `server/container.ts`, no mesmo formato do boletim (`server/container.ts:85-90`).

### 5.1 Rotas

| Método | Rota | Proteção |
|---|---|---|
| GET | `/api/admin/eventos` | `evento:write` |
| POST | `/api/admin/eventos` | `evento:write` |
| GET | `/api/admin/eventos/:id` | `evento:write` |
| PATCH | `/api/admin/eventos/:id` | `evento:write` |
| DELETE | `/api/admin/eventos/:id` | `evento:write` |
| POST | `/api/admin/eventos/:id/publicar` | `evento:publish` |
| POST | `/api/admin/eventos/:id/despublicar` | `evento:publish` |
| POST | `/api/admin/eventos/imagens` | `evento:write` — upload da foto recortada ou da arte |
| GET | `/api/eventos` | pública — próximos eventos publicados |
| GET | `/api/eventos/:slug` | pública — um evento publicado |
| GET | `/eventos/:slug/card.png` | pública — imagem 1200×630 |
| GET | `/eventos/:slug/story.png` | pública — imagem 1080×1920 |

Registro em `server/index.ts` junto dos demais (`server/index.ts:96-106`): as administrativas sob
`/api/admin`, as públicas sob `/api/eventos`, as imagens sob `/eventos`.

A listagem administrativa segue o contrato de paginação padrão `?page=&limit=` com envelope
`{ data, pagination }` (`server/core/pagination.ts:4-24`), mais filtros `status` e
`periodo=proximos|passados`.

A listagem pública `/api/eventos` devolve os publicados com `starts_at >= agora`, ordenados por
`starts_at` crescente, sem paginação — uma igreja não tem centenas de eventos futuros ao mesmo tempo.

### 5.2 Slug

O gerador de slug já existe em `server/modules/boletins/boletins.slug.ts:3`, usado em
`server/modules/boletins/boletins.service.ts:3`. Importar de um módulo para outro quebraria a
fronteira entre módulos, então: **mover `slugify` para `server/core/slug.ts`** e ajustar o import
do boletim. É uma função pura, sem estado — cabe em `core/`, não em `lib/`.

Colisão de slug resolve com sufixo numérico (`vigilia-de-oracao`, `vigilia-de-oracao-2`), verificado
contra o índice único.

### 5.3 Exclusão de imagem em uso

`MediaService` recebe uma lista de verificadores de uso (`server/modules/media/media.service.ts:40-43`,
tipo em `:11`), e o boletim já registra o seu (`server/modules/boletins/boletins.usage.ts:5`,
ligado em `server/container.ts:94`). O evento registra um verificador igual, para que a biblioteca
de mídia não deixe apagar a foto ou a arte de um evento publicado.

---

## 6. Remoção de fundo e imagens geradas

### 6.1 O recorte roda no navegador

A imagem original **não sobe para o servidor**. O recorte acontece na máquina de quem publica,
usando `@huggingface/transformers` (Transformers.js, Apache 2.0) com um modelo de segmentação em
ONNX, acelerado pela placa de vídeo quando o navegador oferece, e caindo para o processador quando não.

**Modelo escolhido: BiRefNet-lite**, licença MIT, com pesos ONNX publicados pelo autor.
A alternativa mais comum, RMBG-1.4, foi **descartada como padrão**: sua licença é Creative Commons
apenas para uso não comercial, e uso comercial exige contrato com a BRIA. Uma igreja provavelmente
se enquadra no uso permitido, mas isso é um julgamento jurídico que a licença MIT dispensa.
RMBG-1.4 fica como plano B caso a medição de §11 reprove o BiRefNet-lite.

Fluxo na tela:

1. A pessoa escolhe o arquivo. Nada sai do computador ainda.
2. O modelo baixa na primeira vez (cache do navegador nas seguintes) e o recorte roda.
3. A tela mostra **original e recortada lado a lado** antes de salvar.
4. A pessoa confirma, troca a foto, ou escolhe **usar a original** — nunca fica presa a um recorte ruim.
5. Confirmado, o resultado é exportado do `canvas` em **WebP com transparência** e enviado.

WebP porque o canal alfa em PNG fica grande, e `processImage` aceita WebP e mantém o formato ao
reencodar (`server/modules/media/media.image.ts:4-8` e `:40-44`), preservando a transparência.
O limite de upload é o mesmo da mídia, 5 MB (`server/core/config.ts:23`).

**Quando o recorte não roda** — navegador antigo, memória insuficiente, modelo que não baixa — a
tela avisa e oferece a foto original. Publicar nunca depende do recorte funcionar.

### 6.2 As imagens de compartilhamento

Duas imagens por evento, geradas com `sharp`, que já é dependência do projeto (`package.json:41`)
e já é usado para processar mídia (`server/modules/media/media.image.ts:1`):

| Imagem | Tamanho | Para quê |
|---|---|---|
| `card.png` | 1200×630 | preview do link no WhatsApp e redes |
| `story.png` | 1080×1920 | Stories do Instagram e status do WhatsApp |

Montagem: um SVG com o fundo, o texto e a faixa da igreja, composto com a foto recortada (ou com a
arte pronta) por `sharp.composite`. Os três estilos de capa são três variações do mesmo SVG.

**Arte pronta nunca é cortada.** Cartaz de igreja é vertical; o card é deitado. Cortar removeria o
título no topo e a data no rodapé, que é onde a arte concentra a informação. Então a arte entra
inteira, na proporção em que foi feita, ao lado do texto, sobre uma cópia dela mesma desfocada
preenchendo as laterais.

As imagens são geradas na publicação e a cada salvamento de evento publicado, gravadas no diretório
de uploads (`server/core/config.ts:21`) em uma pasta `eventos/`, e servidas pelas rotas de §5.1.
Se o arquivo não existir quando pedido, é gerado sob demanda — assim um evento antigo não fica sem
imagem depois de uma limpeza de disco.

### 6.3 Compartilhar

No painel, depois de publicado: copiar link, **enviar no WhatsApp** (`https://wa.me/?text=` com
título, data e link) e **arte para Stories**.

O botão do Stories usa `navigator.share` com a imagem em anexo. No celular isso abre a lista de
aplicativos do próprio sistema, e a pessoa escolhe Instagram ou WhatsApp — a arte chega lá em um
toque. No computador, onde essa lista não existe, o botão baixa a imagem.

**Não existe botão "postar no Instagram".** Publicar no Stories de outra pessoa exige conta
comercial, um aplicativo aprovado pela Meta e autorização por conta. Um botão com esse nome seria
uma promessa que o produto não pode cumprir.

Na página pública também há um botão de compartilhar no WhatsApp (CA-06 da US-29).

### 6.4 Fontes no container — pendência de infraestrutura

O `sharp` desenha o texto do SVG usando as fontes **instaladas no sistema**. A imagem de produção é
`node:20-alpine` sem nenhum pacote de fonte (`Dockerfile:14-22`), e as fontes do site vêm da CDN do
Google só no navegador. Sem correção, o texto das imagens geradas sai errado ou não sai.

Correção, na etapa `runner` do `Dockerfile`: instalar `fontconfig` e versionar no repositório os
arquivos das fontes Montserrat e Inter (ambas sob SIL Open Font License, que permite redistribuição),
copiando-os para dentro da imagem.

---

## 7. Open Graph

O evento publicado recebe as meta tags no servidor, em produção, no mesmo trecho onde isso já é
feito para o boletim (`server/index.ts:116-151`), usando `injectOgTags`
(`server/lib/og.ts:27`, formato do objeto em `server/lib/og.ts:10-20`).

| Tag | Valor |
|---|---|
| título | `title` do evento |
| descrição | `summary` (a chamada) |
| imagem | `PUBLIC_BASE_URL` + `/eventos/:slug/card.png`, 1200×630 |
| url | `PUBLIC_BASE_URL` + `/eventos/:slug` |

`PUBLIC_BASE_URL` é a URL pública absoluta do site (`server/core/config.ts:36`). Em desenvolvimento,
sob o Vite, a injeção não acontece — o bloco inteiro está dentro do `if` de produção
(`server/index.ts:110`). Evento em rascunho ou inexistente cai no catch-all da SPA
(`server/index.ts:153`) e o React mostra 404.

---

## 8. Telas

### 8.1 Componentes canônicos

Nada de classe Tailwind solta: toda tela do painel compõe o kit `src/painel/ui/`
(`src/painel/ui/index.ts`), regra do `docs/patterns/area-administrativa-visual.md`.

| Região | Componente |
|---|---|
| Cabeçalho de página | `PageHeader` (título, subtítulo, ações) |
| Agrupamento de campos | `Card` |
| Campos | `Field` + `Input` / `Select` |
| Descrição em texto rico | `TextBlockEditor` (`src/painel/components/blocks/TextBlockEditor.tsx`) |
| Ações | `Button` (`primary` / `secondary` / `danger` / `ghost`) |
| Estado de publicação | `Badge` (verde publicado, âmbar rascunho) |
| Mensagens de erro e sucesso | `Alert` |
| Lista administrativa | `Table` + `THead` + `EmptyRow` + `Pager` |
| Lista vazia | `EmptyState` |
| Confirmação de exclusão | `Modal` |
| Escolha da imagem | `MediaPicker` (`src/painel/components/MediaPicker.tsx`) para a arte pronta |

**Primitivo que falta no kit:** o seletor de duas opções da capa ("Montar com uma foto" / "Já tenho
a arte"). Não existe equivalente em `src/painel/ui/`. Entra no kit como componente novo, com uma
linha em `docs/patterns/area-administrativa-visual.md` — não improvisado dentro da tela, conforme
a regra do próprio documento.

### 8.2 Rotas de tela

Registradas em `src/App.tsx`, no mesmo formato das do boletim (`src/App.tsx:75-79`); hoje
`/painel/eventos` cai no `EmBreve` do catch-all (`src/App.tsx:80`).

| Rota | Proteção | O que é |
|---|---|---|
| `/painel/eventos` | `evento:write` | lista administrativa |
| `/painel/eventos/:id` | `evento:write` | formulário |
| `/painel/eventos/:id/preview` | `evento:write` | pré-visualização da página, inclusive em rascunho |
| `/eventos` | pública | próximos eventos |
| `/eventos/:slug` | pública | página do evento |

Item novo no menu lateral (`src/painel/nav-config.tsx:28-45`), com `perm: 'evento:write'` e
filhos "Lista" e "Novo evento", no mesmo formato do grupo de boletins (`src/painel/nav-config.tsx:38-43`).

Link "Eventos" no cabeçalho público (`src/components/Header.tsx:4-10`), fixo — diferente do
"Boletim", que só aparece quando existe algum publicado (`src/components/Header.tsx:27-29`).
Fixo porque a página tem estado vazio que se explica, e seção que aparece e some é pior de achar.

### 8.3 Página pública

Renderizador próprio, de layout fixo — mais simples que o `BulletinRenderer`, já que os campos são
fixos. Compartilhado entre a página pública e a pré-visualização do painel, como o boletim faz.

Estrutura: capa (hero) conforme o modo e o estilo escolhidos · descrição em texto rico · como chegar ·
adicionar à agenda · compartilhar no WhatsApp.

**O mapa aparece sempre que `location_address` estiver preenchido**, com o endereço como consulta no
Google Maps incorporado — a mesma integração já usada na seção Sobre da home. O campo vem
pré-preenchido com o endereço da igreja, então o caso comum não exige digitação. Sem endereço, o
bloco mostra só o nome do local.

**O convite de calendário é gerado no navegador**, montando o arquivo `.ics` a partir dos campos já
carregados na página. Não há rota no servidor para isso: é texto simples e nenhum dado a mais é
necessário.

O texto rico reaproveita os estilos `.boletim-prose` de `src/globals.css`. O nome fica devendo uma
renomeação para algo neutro; é dívida registrada, não trabalho desta issue.

---

## 9. Descobribilidade

As quatro perguntas de `~/.claude/rules-sob-demanda/ux-na-spec.md`:

**Pré-requisitos.** Para publicar é preciso a capa definida, além dos obrigatórios. Nenhum
pré-requisito depende de configuração feita em outra tela — a foto e a arte sobem pelo próprio
formulário, sem passar pela biblioteca de mídia (§4). O único condicional é o Open Graph, que
depende de `PUBLIC_BASE_URL` estar definida; sem ela, o link funciona e o preview sai sem imagem.

**Vazio.** Lista administrativa sem nenhum evento: `EmptyState` explicando o que é a ferramenta,
com botão "Novo evento". Filtro sem resultado: mensagem diferente, com ação de limpar o filtro —
nunca o mesmo texto, porque não é a mesma situação. `/eventos` público sem eventos futuros: aviso
de que não há nada marcado, com link para o restante do site.

**Bloqueio.** Tentativa de publicar sem capa é *pré-requisito ausente*: a mensagem diz o que falta
e leva ao cartão da capa, não apenas informa. Data de término anterior à de início é *estado
impossível*: o texto basta. Slug em colisão é resolvido pelo sistema, não pelo usuário.

**Perfil e escopo.** Sem `evento:write` o item nem aparece no menu (o filtro por permissão já existe
em `src/painel/Sidebar.tsx`). Com `evento:write` e sem `evento:publish`, o formulário aparece
inteiro e o botão de publicar **não é mostrado** — em vez de mostrado e recusado. Não há multi-tenant
neste projeto, então não há fatia de dados por usuário.

---

## 10. O que NÃO quebra

Verificado, para ninguém gastar tempo provando de novo:

- **A injeção de Open Graph do boletim não muda.** O tratador do evento é registrado ao lado do dele
  (`server/index.ts:116`), antes do catch-all da SPA (`server/index.ts:153`). São rotas irmãs.
- **A biblioteca de mídia não muda de comportamento.** Ganha mais um verificador de uso, no ponto que
  já aceita uma lista (`server/container.ts:94`). Nenhuma assinatura muda.
- **O editor de boletim não é tocado.** O `TextBlockEditor` é reusado como está; nenhuma alteração
  nele é necessária para o evento.
- **O contrato de paginação não muda.** Os filtros novos são parâmetros adicionais de query.
- **Nenhuma permissão existente é alterada.** Só entram duas linhas no catálogo, e o seed as concede
  ao `admin` no próximo boot.
- **Mover `slugify` para `core/` toca um único import** (`server/modules/boletins/boletins.service.ts:3`).

---

## 11. O que medir antes de implementar

Três medições curtas, todas executáveis por quem for implementar — nenhuma depende de acesso que
ninguém tem:

1. **Modelo de recorte.** Baixar o BiRefNet-lite em ONNX e medir, numa página solta: tamanho do
   download, tempo do primeiro recorte e de um segundo com o modelo em cache, e qualidade em uma
   foto com cabelo solto e fundo de sala. Reprovar acima de ~80 MB ou ~15 s no cache frio, e aí cair
   para o plano B.
2. **Fonte no container.** Subir a imagem com `fontconfig` e as fontes versionadas e gerar um
   `card.png` de teste, conferindo se o texto sai em Montserrat e não numa substituta.
3. **Tamanho do recorte em WebP.** Exportar uma foto de celular recortada e conferir se cabe
   folgadamente nos 5 MB do limite de upload.

---

## 12. Dívidas registradas

- Nome da classe `.boletim-prose` usada fora do boletim (§8.3).
- Seletor de duas opções entra no kit de UI e no guia visual (§8.1).
- Marcar evento encerrado na lista administrativa é o CA-08 da US-29, classificado como *Could* —
  fica para depois, e o link público continua funcionando de qualquer forma.

---

## ONDE FICA

```
ONDE FICA
- injeção de Open Graph do boletim (modelo a copiar)  server/index.ts:116-151
- montagem das meta tags                              server/lib/og.ts:27 (formato em :10-20)
- registro das rotas no Express                       server/index.ts:96-106
- catch-all da SPA (404 de rascunho cai aqui)         server/index.ts:153
- composition root, formato do boletim                server/container.ts:85-90
- lista de verificadores de uso de mídia              server/container.ts:94
- verificador de uso do boletim (modelo a copiar)     server/modules/boletins/boletins.usage.ts:5
- tipo do verificador                                 server/modules/media/media.service.ts:11 e :40-43
- upload de mídia exige media:manage                  server/modules/media/media.routes.ts:40
- formatos aceitos e reencode preservando alfa        server/modules/media/media.image.ts:4-8 e :40-44
- limite de upload (5 MB) e uploadsDir                server/core/config.ts:23 e :21
- PUBLIC_BASE_URL                                     server/core/config.ts:36
- gerador de slug (a mover para core/)                server/modules/boletins/boletins.slug.ts:3
- único import do slugify                             server/modules/boletins/boletins.service.ts:3
- contrato de paginação                               server/core/pagination.ts:4-24
- runner de migrations e diretório                    server/core/db.ts:42 e :40
- índice único parcial de slug (modelo)               server/migrations/005_boletins.sql:18
- catálogo de permissões                              server/seed/permissions.catalog.ts:8-9
- rotas de tela do boletim (modelo)                   src/App.tsx:75-79
- catch-all do painel (hoje mostra "Em breve")        src/App.tsx:80
- menu lateral e grupo do boletim                     src/painel/nav-config.tsx:28-45
- kit de UI                                           src/painel/ui/index.ts
- editor de texto rico a reusar                       src/painel/components/blocks/TextBlockEditor.tsx
- seletor de imagem da biblioteca                     src/painel/components/MediaPicker.tsx
- link condicional do boletim no cabeçalho            src/components/Header.tsx:27-29
- estilos do texto rico                               src/globals.css (.boletim-prose)
- imagem de produção, sem fontes                      Dockerfile:14-22
- sharp já é dependência                              package.json:41
- conferido em                                        76b3708
```
