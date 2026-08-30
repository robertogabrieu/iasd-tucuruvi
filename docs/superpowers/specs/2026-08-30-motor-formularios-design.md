# Spec — Motor de Formulários (US-30)

- **Data:** 2026-08-30
- **Branch:** `feature/motor-formularios`
- **Histórias cobertas:** US-30 (Motor de formulários)
- **Referência de arquitetura:** `CLAUDE.md` → *Backend — Área Administrativa, Autenticação e RBAC*
- **Referência visual:** `docs/patterns/area-administrativa-visual.md`
- **Backlog:** `docs/historias/US-30-motor-formularios.md`

---

## 1. Objetivo e contexto

O site tem hoje **um** formulário público (Estudos Bíblicos). O tratamento dele vive solto em
`server/index.ts`: valida com Zod, sanitiza e chama `sendContatoEmail`. **Nada é persistido.**
Se o SMTP falha, o pedido some e quem preencheu recebe erro — motivo pelo qual a seção está
oculta no site.

Esta spec cria o **motor**: uma via única por onde toda submissão de todo formulário entra, é
gravada e passa a ser consultável e exportável no painel. Formulários futuros — com campos
diferentes — entram no motor declarando um **arquivo de definição**, sem migration, sem tela nova
e sem código de exportação novo.

**O que o motor é:** captura, persistência, consulta e exportação.
**O que o motor não é:** renderizador de formulário público. Cada formulário do site continua
sendo um componente React próprio, com o texto e o visual da seção onde ele mora. O que a
definição garante é que o envio dele cai no motor e a gestão sai de graça.

## 2. Escopo

### Dentro do escopo

| CA (US-30) | Resumo |
|---|---|
| CA-01 | Persistir a submissão antes do e-mail; falha de e-mail não derruba o envio |
| CA-02 | Validação derivada da definição + honeypot + rate limit |
| CA-03 | Listagem paginada, colunas vindas da definição (máx. 4) |
| CA-04 | Detalhe com todos os campos |
| CA-05 | Busca livre, período e seletores por campo de escolha; filtro no endereço |
| CA-06 | Exportação CSV do conjunto filtrado, com todos os campos |
| CA-07 | Estados: carregando, vazio-sem-envios, vazio-por-filtro, erro |
| CA-08 | Formulário novo entra pelo catálogo; catálogo inválido barra o boot |

### Fora do escopo

| Item | Motivo |
|---|---|
| Situação de atendimento e anotação interna | Decidido no brainstorming: tela **somente leitura** |
| Excluir submissão pelo painel (LGPD) | Registrado como pendência; hoje só via banco |
| Construtor visual de formulários | Definição vive no código, por decisão |
| Formulário público renderizado pela definição | Cada seção do site tem design próprio |
| Expurgo/retenção automática de submissões antigas | Sem demanda |
| Confirmação por e-mail para quem preencheu | Não existe hoje |

## 3. Decisões de design (confirmadas no brainstorming)

1. **Uma tabela para todos os formulários**, com os dados em `jsonb`. Descartadas: tabela por
   formulário (cada form novo viraria migration + tela) e modelo campo-a-campo em linhas
   (consulta e filtro tortos e lentos).
2. **Definição em código, num catálogo central.** Criar formulário = criar o arquivo de definição.
3. **Banco é a fonte da verdade; e-mail é aviso.** Grava, responde sucesso, tenta notificar. O
   resultado da notificação fica registrado na própria submissão.
4. **Tela somente leitura**, com filtro e exportação.
5. **Exportação em CSV** que abre no Excel em português. Sem dependência nova.
6. **A tela é dirigida por dados vindos do servidor.** O painel busca o catálogo pela API; não há
   cópia da definição no frontend. É o que faz CA-08 valer sem tocar nas telas.

## 4. Modelo de dados — `server/migrations/007_form_submissions.sql`

```sql
-- server/migrations/007_form_submissions.sql
-- Motor de formulários: toda submissão de todo formulário público (US-30).
CREATE TABLE form_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_key      text NOT NULL,
  data          jsonb NOT NULL,
  notified_at   timestamptz,
  notify_error  text,
  submitted_ip  inet,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Listagem e filtro por período sempre partem do formulário.
CREATE INDEX idx_form_submissions_form_created ON form_submissions (form_key, created_at DESC);
```

- `form_key` é **texto livre, sem chave estrangeira**: o catálogo é código, não tabela. Submissão de
  um formulário que depois for retirado do catálogo continua no banco e simplesmente não aparece no
  painel — comportamento desejado (o dado não se perde).
- `notified_at` / `notify_error`: `notified_at` preenchido = aviso saiu. `notify_error` preenchido =
  falhou, com o motivo curto. Ambos nulos = o formulário não declara notificação (§5).
- **Sem índice GIN em `data`.** O volume esperado é de dezenas a centenas de linhas por ano; o
  índice composto acima já cobre a listagem, e um GIN não acelera busca por trecho (`ILIKE`).
  Adicionar depois, se o volume mudar, é migration de uma linha.

## 5. Definição de formulário — `server/modules/forms/catalog/`

```ts
export type FieldType = 'text' | 'longtext' | 'email' | 'phone' | 'choice' | 'date'

export interface FormField {
  key: string
  label: string                 // rótulo que a pessoa viu no site; é o cabeçalho do CSV
  type: FieldType
  required?: boolean
  options?: string[]            // obrigatório quando type === 'choice'
  maxLength?: number            // default por tipo
  inList?: boolean              // vira coluna na listagem — no máximo 4 por formulário
  searchable?: boolean          // entra na busca livre; só em campos de texto
}

export interface FormDefinition {
  key: string                   // segmento de URL, minúsculo com hífens
  label: string                 // nome no painel
  description?: string          // subtítulo da tela
  fields: FormField[]
  /** Ausente = este formulário não avisa ninguém; a submissão só é gravada. */
  notify?: {
    subject: string
    to?: string                 // ausente = destinatário padrão das configurações de e-mail
  }
}
```

`catalog/index.ts` exporta `FORMS: FormDefinition[]` e um `findForm(key)`. O primeiro morador é
`catalog/estudos-biblicos.ts`, reproduzindo os campos de hoje: nome, telefone, e-mail e melhor
horário para contato (escolha entre Manhã / Tarde / Noite / Qualquer horário).

### Guardrail: catálogo inválido barra o boot

`validateCatalog(FORMS)` roda no bootstrap, antes de as rotas subirem, e derruba o processo com
mensagem apontando o formulário e o campo quando encontra: chave de formulário repetida ou fora do
formato de URL; chave de campo repetida dentro do formulário; campo `choice` sem `options`; mais de
quatro campos com `inList`; `searchable` em campo que não é de texto.

Sem isso, um formulário mal declarado só apareceria quebrado na tela, semanas depois — e a tela
não tem como se defender de uma definição inconsistente.

### Do que a definição deriva

| Deriva | Como |
|---|---|
| Validação do envio | `buildSubmissionSchema(def)` monta o Zod a partir dos campos + honeypot |
| Colunas da listagem | campos com `inList` |
| Busca livre | campos com `searchable` |
| Seletores de filtro | campos `choice`, com suas `options` |
| Diálogo de detalhe | todos os campos, na ordem declarada |
| Cabeçalho e colunas do CSV | todos os campos, na ordem declarada |

`buildSubmissionSchema` e `validateCatalog` são **funções puras** em `forms.definition.utils.ts` —
não classes (regra anti-complexidade do `CLAUDE.md`).

## 6. Backend — `server/modules/forms/`

```
server/modules/forms/
├── forms.controller.ts          # HTTP fino: DTO → service → resposta
├── forms.service.ts             # regra: gravar, notificar, listar, montar CSV
├── forms.repository.ts          # único ponto com SQL
├── forms.routes.ts              # rotas públicas e administrativas
├── forms.csv.ts                 # serialização CSV (função pura)
├── forms.mail.ts                # corpo do aviso, genérico a partir da definição
├── forms.definition.utils.ts    # validateCatalog, buildSubmissionSchema, projeção pública
├── dto/submission.dto.ts        # query de listagem e filtros
└── catalog/
    ├── index.ts
    └── estudos-biblicos.ts
```

Fluxo obrigatório do projeto: `routes → controller → service → repository → db`. Injeção por
construtor no `container.ts`.

### Rotas públicas — montadas em `/api/formularios`

| Método | Rota | Comportamento |
|---|---|---|
| POST | `/api/formularios/:formKey` | Rate limit 5/min por IP. `formKey` desconhecido → 404. Valida contra a definição, sanitiza cada valor de texto, **grava**, responde `{ success: true }`, e só então tenta o aviso por e-mail, registrando o resultado na linha. |

O e-mail é disparado **depois da resposta** e o seu erro nunca vira erro HTTP: é capturado e
gravado em `notify_error`.

`POST /api/contato` e o bloco solto em `server/index.ts` são **removidos**; o componente
`EstudosBiblicos.tsx` passa a postar em `/api/formularios/estudos-biblicos`. Não há consumidor
externo dessa rota — só o próprio site. `server/lib/schemas.ts` (cópia server do schema de contato)
e `sendContatoEmail` saem junto: a validação passa a vir da definição e o aviso passa a ser genérico.

### Rotas administrativas — montadas em `/api/admin`

| Método | Rota | Permissão | Retorno |
|---|---|---|---|
| GET | `/formularios` | `forms:read` | Catálogo em projeção pública (sem `notifyTo`), cada item com total de submissões e data do último envio |
| GET | `/formularios/:formKey/submissoes` | `forms:read` | Envelope padrão `{ data, pagination }` (`?page=&limit=`) |
| GET | `/formularios/:formKey/submissoes.csv` | `forms:export` | `text/csv` com `Content-Disposition: attachment` |

**Parâmetros de filtro**, iguais nas duas últimas rotas:

| Parâmetro | Efeito |
|---|---|
| `q` | trecho procurado nos campos `searchable`. Não diferencia maiúsculas (`ILIKE`); **diferencia acento** — "Jose" não encontra "José". Aceitável no volume esperado; resolver exigiria a extensão `unaccent` no Postgres |
| `de` / `ate` | intervalo sobre `created_at`; `ate` inclui o dia inteiro |
| `f_<chave>` | valor exato num campo `choice`; validado contra as `options` da definição |

Parâmetro `f_` de campo inexistente ou valor fora das `options` → 400. O filtro nunca é
interpolado em SQL: chave e valor passam pela definição antes de virar parâmetro `$n`.

### CSV — `forms.csv.ts`

- Separador `;`, quebra de linha CRLF, **BOM UTF-8** no início — é o que faz o Excel em português
  abrir com acentuação certa e colunas separadas.
- Colunas: `Recebido em` (dd/mm/aaaa hh:mm) + um por campo da definição, com o rótulo como
  cabeçalho + `Aviso por e-mail` (Enviado / Falhou / Não configurado — este último quando o
  formulário não declara `notify`).
- Aspas duplicadas conforme RFC 4180.
- **Neutralização de fórmula:** valor começando com `=`, `+`, `-`, `@`, tabulação ou retorno de
  carro recebe apóstrofo à frente. Os dados vêm de formulário público aberto na internet; sem isso,
  o CSV é um vetor de execução de fórmula na planilha de quem abrir.
- Teto de 10.000 linhas por exportação, com a resposta enviada em fluxo (sem montar tudo em memória).

## 7. Frontend — `/painel/formularios`

> **O desenho é o alvo.** `2026-08-30-motor-formularios-mockup.html`, nesta mesma pasta, mostra as
> seis telas: índice, listagem com dados, um segundo formulário de campos diferentes, vazio sem
> envios, vazio por filtro, e carregando. **Se este texto e o desenho divergirem, o desenho vence** —
> foi ele que foi aprovado olhando. Cada bloco dele vira um item do roteiro de QA.
>
> **Do desenho não se copia CSS.** Ele traz as classes do painel por conveniência, mas quem manda são
> os componentes de `@/painel/ui`; o que se copia é a estrutura e as decisões.

### Índice — `src/painel/pages/Formularios.tsx` (`/painel/formularios`)

`PageHeader` "Formulários" + grade de `Card`s, um por formulário: nome, descrição, total de envios
e data do último. Cartão inteiro é o link. Vazio (catálogo sem formulários) → `EmptyState`.

A entrada no menu lateral é **única** (`Formulários`, com `perm: 'forms:read'`), não um submenu por
formulário: `nav-config.tsx` é estático e o catálogo vem do servidor: um submenu obrigaria o layout
a carregar o catálogo em toda navegação. O índice resolve o mesmo problema e ainda mostra o total
de envios, que o menu não mostraria.

### Submissões — `src/painel/pages/FormularioSubmissoes.tsx` (`/painel/formularios/:formKey`)

**A tarefa da tela:** *ver quem pediu contato, pegar o telefone para ligar, ou levar a lista para
uma planilha.* Não se cadastra nada aqui — por isso não há botão de criar, e a única ação em
destaque é **Exportar**.

Anatomia, de cima para baixo:

1. **`PageHeader`** — título = nome do formulário; subtítulo = descrição + total de envios; ação
   única à direita: `Button` **Exportar CSV** (escondido sem `forms:export`).
2. **Faixa de filtros** (`FilterBar`, novo no kit) — busca livre (campo mais largo), `de` e `ate`,
   e um `Select` para cada campo `choice` da definição. `Button ghost` **Limpar** aparece só quando
   há filtro ativo. Os seletores exibidos são os daquele formulário: um formulário sem campo de
   escolha mostra apenas busca e período.
3. **`Table`** — `Recebido em` + os campos `inList` + `Aviso` (`Badge`) + ícone de ver detalhe.
   Linha inteira clicável.
4. **`Pager`**.

**O limite de quatro colunas é o que resolve "campos diferentes".** Um formulário de vinte campos
não pode esparramar vinte colunas: as quatro que importam ficam na tabela, o resto no detalhe.
Quem escolhe as quatro é a definição, não a tela.

**Detalhe:** `Modal size="lg"` com pares rótulo/valor na ordem da definição, e um rodapé discreto
com recebido em, situação do aviso e endereço de rede de origem.

**Filtros no endereço:** estado vive na query string via `useSearchParams`. Recarregar, voltar ou
mandar o link para outra pessoa preserva o filtro. A exportação usa **os mesmos parâmetros** — o que
está na tela é o que baixa.

**O download não pode ser um link direto** (`<a href>` para a rota do CSV). O cookie de sessão dura
cerca de 15 minutos e a renovação só acontece dentro do cliente de API (`src/auth/api-core.ts:36-44`:
resposta 401 → `/refresh` → repete). Uma tela aberta há mais de 15 minutos entregaria à pessoa um
JSON de erro no lugar da planilha, sem explicação. O botão então baixa por `adminFetch`, transforma
a resposta em `Blob`, e dispara o download por um `<a download>` temporário com `URL.createObjectURL`
(revogado em seguida). O nome do arquivo sai do cabeçalho `Content-Disposition` da resposta.

**Estados:** `Spinner` centralizado enquanto carrega (nunca o vazio piscando); `EmptyState` com dois
textos distintos — "Ainda não chegou nenhum envio deste formulário" (sem filtro) e "Nenhum envio
corresponde ao filtro" + ação de limpar; `Alert` em erro de rede.

### Novo primitivo no kit — `src/painel/ui/FilterBar.tsx`

Nenhuma tela do painel filtra hoje, e o kit não tem faixa de filtros. Em vez de resolver com classes
soltas nesta tela (o que garantiria uma segunda variante na próxima), o componente entra no kit e em
`docs/patterns/area-administrativa-visual.md`: superfície branca `rounded-xl shadow-sm`, campos em
`grid gap-4` que quebra em coluna no celular, ação de limpar à direita. Sem valor de espaçamento fora
da escala do projeto.

### API do painel — `src/painel/forms-api.ts`

Tipos espelhando a projeção pública da definição, `listarFormularios()`, `listarSubmissoes(...)` e
`urlExportacao(...)`. Sem cópia do catálogo no frontend.

## 8. Segurança e privacidade

- **Anti-robô:** honeypot (já existe) e rate limit de 5 envios/min por IP, agora aplicados por
  formulário na rota genérica.
- **Sanitização:** todo valor de texto passa por `sanitize` antes de gravar, como hoje.
- **CSV:** neutralização de fórmula (§6) — o dado é público e vai parar numa planilha.
- **Endereço de rede:** guardado para permitir barrar abuso; aparece só no detalhe, para quem tem
  `forms:read`, e **não** vai no CSV. A coluna é do tipo `inet`, então o valor precisa ser um
  endereço válido: hoje `server/index.ts:31` cai na string `'unknown'` quando não descobre a origem,
  e gravar isso derrubaria a inserção **junto com a submissão**. O serviço grava `NULL` quando o
  endereço não parseia — perder a origem nunca pode custar o pedido.
- **Exportação é permissão separada** (`forms:export`): tirar dados pessoais do sistema é ação
  distinta de consultá-los.
- **CSRF:** as rotas administrativas são de leitura (GET) e seguem o padrão do projeto; a rota
  pública de envio não usa cookie de sessão.

## 9. Permissões e dependências

Duas linhas novas em `server/seed/permissions.catalog.ts` — sem migration, e o papel `admin` as
recebe no próximo boot:

| Chave | Descrição |
|---|---|
| `forms:read` | Ver submissões de formulários |
| `forms:export` | Exportar submissões de formulários |

Nenhuma dependência npm nova. Reaproveita: `core/pagination.ts`, `core/errors.ts` + handler central,
`lib/rate-limit.ts`, `lib/sanitize.ts`, `lib/mail.ts` (`sendMail` já resolve banco→env), kit de UI e
`RequirePermission`.

## 10. Testes automatizados

O `CLAUDE.md` diz que o projeto não tem suíte ativa. Está **desatualizado**: existem cinco arquivos
em `__tests__/` rodando sob Jest + ts-jest (`jest.config.cjs`), com o mapeamento do sufixo `.js` que
o ESM do servidor exige. O que falta é o atalho — **não há script `test` no `package.json`**, então
rodar exige `npx jest`. Esta entrega adiciona o script e corrige a afirmação no `CLAUDE.md`.

Ficam cobertas por teste as três funções puras, que são onde o motor pode errar em silêncio:

| Alvo | O que o teste trava |
|---|---|
| `validateCatalog` | catálogo inválido (chave repetida, `choice` sem opções, cinco colunas de destaque) tem de ser recusado |
| `buildSubmissionSchema` | obrigatório vazio, valor fora das opções e campo desconhecido são recusados; envio válido passa |
| `toCsv` | separador, BOM, aspas, e **neutralização de fórmula** — um nome começando com `=` não pode virar cálculo na planilha |

**Dois testes existentes quebram com esta entrega e precisam ser tratados junto:**
`__tests__/schemas/contato.test.ts` cobre `src/schemas/contato.ts`, que será removido — o arquivo de
teste sai junto, e o que ele garantia passa a ser garantido pelo teste de `buildSubmissionSchema`
sobre a definição de Estudos Bíblicos. `__tests__/lib/mail.test.ts:38-45` cobre `sendContatoEmail`,
também removido — esse bloco é substituído pelo do aviso genérico.

Repository, controller e rotas ficam sem teste automatizado (exigiriam Postgres em teste, que o
projeto não tem) e são cobertos pelo roteiro manual abaixo.

## 11. Verificação manual

1. Enviar o formulário de Estudos Bíblicos no site → confirmação na tela; linha nova na listagem.
2. Derrubar o e-mail (configuração inválida) e enviar de novo → a pessoa ainda vê sucesso; a linha
   aparece marcada como aviso falhado.
3. Enviar com obrigatório vazio e com o campo-armadilha preenchido → recusado nos dois casos.
4. Sexto envio dentro de um minuto → recusado pelo limite.
5. Filtrar por trecho do nome, por período e por horário; recarregar a página → filtro preservado.
6. Exportar e abrir no Excel → acentos corretos, colunas separadas, todos os campos presentes,
   apenas as linhas filtradas.
7. Enviar um formulário cujo nome comece com `=1+1` e exportar → a planilha mostra o texto, não
   calcula.
8. Entrar com usuário sem `forms:export` → botão de exportar ausente; a URL do CSV responde 403.
9. Declarar um formulário de teste com cinco campos de destaque → o servidor recusa subir, apontando
   o formulário.
10. Declarar um formulário de teste válido → aparece no índice e a listagem funciona **sem tocar em
    nenhuma tela**.

## 12. Definição de pronto (US-30)

- [ ] CA-01 a CA-08 verificados pelo roteiro da §11.
- [ ] `npx jest` verde, incluindo os testes novos das três funções puras.
- [ ] `npm run test` existe e roda a suíte.
- [ ] `POST /api/contato`, `server/lib/schemas.ts` e `sendContatoEmail` removidos; nada no site aponta
      para a rota antiga.
- [ ] `FilterBar` documentado em `docs/patterns/area-administrativa-visual.md`.
- [ ] `CLAUDE.md` descreve o motor e o que é preciso para criar um formulário novo.

> **Depende de decisão, fora do pronto:** a seção de Estudos Bíblicos está **oculta** no site desde
> que o SMTP não foi configurado. Com o motor, o pedido deixa de se perder mesmo sem e-mail — mas
> reexibir a seção é decisão de conteúdo, não desta implementação.
