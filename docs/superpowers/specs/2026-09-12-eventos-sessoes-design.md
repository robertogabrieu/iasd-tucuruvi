# Eventos com vários horários — programação em sessões

**Depende de:** `docs/superpowers/specs/2026-08-29-eventos-design.md` (US-29) · **Branch:** `spec/eventos-sessoes`

**Mockup:** `docs/superpowers/specs/2026-09-12-eventos-sessoes-mockup.html` (abrir no navegador).
**Em caso de divergência entre esta spec e o mockup, o mockup vence** — ele é o que foi aprovado
olhando. Dele se copia **estrutura e decisão**, nunca CSS: as classes reais saem dos componentes do
projeto (`src/painel/ui/` e `src/components/evento/`).

Esta spec **altera** o modelo de datas decidido na US-29. Onde as duas divergirem, esta vence.

---

## 1. O problema

Um evento tem hoje **um** par de data/hora: início e término opcional. Programação que acontece em
mais de um horário — sexta 20h, sábado 9h30, sábado 16h30 — não cabe nesse par. O contorno atual é
cadastrar três eventos separados, cada um com sua página, seu link e sua arte, o que quebra o
compartilhamento (três links para a mesma programação) e polui a lista de próximos eventos.

## 2. O que esta spec decide

| # | Decisão | Resolução |
|---|---|---|
| 1 | Onde a lista de horários fica guardada | **Tabela `evento_sessoes`**, ligada ao evento. Ver §4. |
| 2 | Cada horário tem identidade própria? | **Sim**: título e descrição curta por sessão. |
| 3 | Responsável por sessão | **Não.** Um responsável para o evento inteiro, como hoje. A capa não muda. |
| 4 | Local por sessão | **Não.** Um local para o evento inteiro. |
| 5 | O que ordena a lista pública | A **próxima sessão que ainda não passou**. §5.3. |
| 6 | Quando o evento sai da lista | Depois da **última** sessão. §5.3. |
| 7 | O que a arte de compartilhamento mostra | O **intervalo de dias** + quantidade de horários. §6. |
| 8 | O que o convite de calendário baixa | **Um compromisso por sessão**, em um arquivo só. §7. |

## 3. Escopo

**Entra**

- Tabela de sessões, migration e migração dos eventos que já existem.
- Edição da programação no formulário do evento (adicionar, remover, reordenar por horário).
- Bloco "Programação" na página pública do evento.
- Intervalo de datas no cartão da lista pública, na lista do painel e nas duas artes geradas.
- Convite de calendário com um compromisso por sessão.
- Regras de publicação e mensagens de pendência para a programação.

**Não entra**

- Recorrência automática ("toda quarta por 6 semanas"). Sessão é digitada uma a uma.
- Inscrição ou presença por sessão.
- Responsável, local, capa ou cor por sessão.
- Agenda unificada da igreja. Continua sendo a lista de eventos.

---

## 4. Modelo de dados

### 4.1 A tabela

Migration nova (`server/migrations/009_evento_sessoes.sql`; as migrations rodam no boot, por ordem
de nome — `server/core/db.ts`):

```sql
CREATE TABLE evento_sessoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id   uuid NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz,
  title       text,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_evento_sessoes_evento ON evento_sessoes (evento_id, starts_at);
CREATE UNIQUE INDEX idx_evento_sessoes_instante ON evento_sessoes (evento_id, starts_at);
```

`ON DELETE CASCADE`: apagar o evento apaga a programação — sessão não existe fora do evento.

O índice único sobre `(evento_id, starts_at)` recusa duas sessões no mesmo instante. Programação
com dois horários idênticos é erro de digitação, não intenção, e é mais barato barrar no banco do
que descobrir depois pela página publicada.

**Não há coluna de ordem.** A programação é sempre cronológica, calculada por `starts_at`.

### 4.2 Campos da sessão

| Campo | Tipo | Regra |
|---|---|---|
| `startsAt` | data e hora | Obrigatório. |
| `endsAt` | data e hora | Opcional, como no evento hoje. Se existir, precisa ser depois do início. |
| `title` | texto até 120 | Opcional. É o rótulo: "Abertura", "Escola Sabatina especial". |
| `description` | texto até 500 | Opcional. **Texto simples**, não editor rico. |

`description` é texto simples de propósito: três sessões com editor rico cada uma transformam o
formulário numa página de blocos e a programação numa parede de texto. O texto longo continua
cabendo na descrição do evento, que aparece acima da programação.

**Teto de 20 sessões por evento**, validado no schema de entrada. Não é limite de produto: é o
guardrail que impede uma lista digitada em loop de estourar a página e a geração das artes.

### 4.3 As colunas de data do evento passam a ser derivadas

`eventos.starts_at` e `eventos.ends_at` **continuam existindo** e param de ser digitadas:

- `starts_at` = início da **primeira** sessão.
- `ends_at` = término da **última** sessão — `null` se a última sessão não tiver término.

O servidor reescreve as duas a cada gravação da programação. Elas sobrevivem porque alimentam o
filtro de próximos/passados do painel, a ordenação da lista administrativa e o índice
`idx_eventos_status_starts` que já existe. `starts_at` continua `NOT NULL`.

A API continua entregando `startsAt`/`endsAt` no evento, e passa a entregar também `sessions`.
Quem lê uma data única (a arte, a lista do painel) não precisa mudar de campo; quem precisa da
programação lê `sessions`. **A fonte da verdade é `sessions`** — as duas colunas são cache.

### 4.4 Migração do que já existe

A mesma migration copia cada evento para uma sessão única, sem rótulo e sem descrição:

```sql
INSERT INTO evento_sessoes (evento_id, starts_at, ends_at)
SELECT id, starts_at, ends_at FROM eventos;
```

Evento que já existe vira, sozinho, um evento de uma sessão. Nada muda na tela dele: sessão sem
rótulo em programação de uma linha só não renderiza bloco nenhum (§8.2).

### 4.5 Rascunho recém-criado

Rascunho nasce hoje com `starts_at = now()` porque a coluna é `NOT NULL` e o formulário pode nascer
pela metade (`EventosService.create`). Passa a nascer com **uma sessão** em "agora", pelo mesmo
motivo e com o mesmo efeito na tela: o campo já vem preenchido com a data de hoje, para ser
trocado.

---

## 5. Backend

### 5.1 Entrada e gravação

Nenhuma rota nova. A programação viaja **dentro** do evento, em `sessions`, no mesmo `POST
/api/admin/eventos` e `PATCH /api/admin/eventos/:id` de hoje.

`sessions` é **substituição integral**: o que o formulário manda é a programação inteira, e o
servidor apaga e regrava as sessões daquele evento numa transação. Diff por id sessão a sessão
custaria três caminhos de código (criar, alterar, remover) para um formulário que carrega a lista
toda na tela de qualquer jeito.

`sessions` ausente no `PATCH` significa "não mexe na programação" — a convenção que o resto do DTO
já usa para campo não informado.

Depois de gravar, e na mesma transação, o servidor recalcula `starts_at`/`ends_at` do evento (§4.3).
A regeração das artes continua onde está, no fim do `update`.

### 5.2 Validação

No schema Zod (`server/modules/eventos/dto/evento.dto.ts` e o espelho em `src/schemas/evento.ts`):
cada sessão precisa de `startsAt`; `endsAt`, quando presente, precisa ser depois do início; no
máximo 20 sessões; instantes de início não se repetem dentro do mesmo evento.

O choque de horário é validado **nos dois lugares** — no schema, para dar mensagem apontando a
sessão, e no índice único, para que nenhum caminho de gravação futuro escape dele.

### 5.3 Listagem pública

`listUpcomingPublished` hoje é `WHERE status='published' AND starts_at >= now() ORDER BY starts_at`.
Passa a perguntar pelas sessões:

```sql
SELECT e.* FROM eventos e
WHERE e.status = 'published'
  AND EXISTS (
    SELECT 1 FROM evento_sessoes s
    WHERE s.evento_id = e.id AND coalesce(s.ends_at, s.starts_at) >= now()
  )
ORDER BY (
  SELECT min(s.starts_at) FROM evento_sessoes s
  WHERE s.evento_id = e.id AND coalesce(s.ends_at, s.starts_at) >= now()
) ASC
```

O `EXISTS` é o "sai da lista depois da última sessão": o evento fica no ar enquanto qualquer sessão
não tiver terminado. A subconsulta do `ORDER BY` é o "ordena pela próxima sessão pendente": um
evento que começou sexta e ainda tem sábado pela frente se ordena pelo sábado, e não pela sexta que
já passou — com `ORDER BY starts_at` ele apareceria à frente de tudo para sempre.

As duas subconsultas varrem só as sessões de eventos publicados, dezenas de linhas. Se um dia
pesarem, o conserto é uma coluna derivada a mais (`proxima_sessao_at`), não um índice diferente.

A página do evento (`/eventos/:slug`) **não** filtra por data, hoje nem depois: link divulgado
continua abrindo depois que a programação acaba.

O DTO da lista pública passa a carregar `sessions`, que é o que o cartão usa para dizer quantos
horários existem.

### 5.4 Regras de publicação

Em `eventos.publish-rules.ts`, "Informe a data e a hora de início" vira:

- Sem nenhuma sessão: **"Informe pelo menos um horário para o evento."**
- Sessão com término antes ou igual ao início: **"O término precisa ser depois do início."** — a
  mensagem de hoje, agora apontando qual horário.

Rótulo de sessão continua opcional mesmo com várias sessões: programação de fim de semana que só
lista dia e hora é legítima.

---

## 6. As artes de compartilhamento

`quandoPorExtenso` (`eventos.image.ts`) monta hoje uma linha: "Sábado, 26 de setembro · 19h30".
Passa a resumir a programação inteira, ainda em **uma linha**:

| Programação | Texto |
|---|---|
| Uma sessão | `Sábado, 26 de setembro · 19h30` — igual a hoje |
| Várias no mesmo dia | `Sábado, 26 de setembro · 3 horários` |
| Vários dias, mesmo mês | `13 e 14 de março · 3 horários` (dois dias) · `13 a 15 de março · 4 horários` (três ou mais) |
| Meses diferentes | `27 de fevereiro a 2 de março · 4 horários` |

**Por que intervalo e não "a próxima sessão":** as duas imagens são geradas no salvamento e ficam
guardadas em disco (`eventos.image.storage.ts`), não são desenhadas a cada visita. Uma arte que
dissesse "próximo: sexta 20h" continuaria dizendo isso no domingo. Regerar a cada visita resolveria,
ao custo de desenhar dois PNGs a cada abertura de link compartilhado — caro para um caso que a
página logo abaixo já resolve.

O texto é desenhado como um `<text>` único, sem quebra de linha (`eventos.image.styles.ts`), tanto
no cartão 1200×630 quanto no story 1080×1920. Os formatos acima cabem nessa linha; a lista dos três
horários não caberia. Quem clica vê a programação completa na página.

---

## 7. Convite de calendário

`montarIcs` (`src/components/evento/evento-ics.ts`) monta hoje um `VEVENT`. Passa a montar **um por
sessão**, no mesmo arquivo e no mesmo botão: quem clica uma vez leva os três compromissos para a
agenda, cada um com o lembrete próprio do celular.

- `UID` = o id da sessão. Baixar de novo atualiza o compromisso em vez de duplicar.
- `SUMMARY` = `<título do evento> — <título da sessão>` quando a sessão tem rótulo; só o título do
  evento quando não tem.
- `DTSTART`/`DTEND` = os da sessão. Sessão sem término continua saindo sem `DTEND`, pela mesma
  razão de hoje: não inventar duração que ninguém publicou.
- `DESCRIPTION`, `LOCATION` e `URL` vêm do evento, repetidos em cada compromisso — é o que faz cada
  entrada da agenda se explicar sozinha.

---

## 8. Telas

### 8.1 Editor — o card "Quando"

O card deixa de ser um par de campos e vira uma lista. Um bloco por sessão, na ordem do relógio:

Desenho aprovado: `docs/superpowers/specs/2026-09-12-eventos-sessoes-mockup.html`, seção 1.

```
Quando e onde                                    3 horários
┌──────────────────────────────────────────────────────────┐
│ Sexta, 13 de março · 20h00                     [Remover] │
│ Início [13/03 20:00]  Término [21:30]  Título [Abertura] │
│ Descrição [                                            ] │
└──────────────────────────────────────────────────────────┘
                                       [+ Adicionar horário]

Local    [Salão principal — IASD Tucuruvi]
Endereço [R. Cruz de Malta, 1201        ]  vale para todos os horários
```

O cabeçalho de cada bloco repete, por extenso, o que foi digitado ("Sexta, 13 de março · 20h00"):
data errada aparece como dia da semana errado antes de publicar, não depois.

Início, término e título dividem uma linha de três colunas em tela larga, e empilham no celular.
Medido no mockup: o cartão inteiro com três horários fica em 1071px de altura; com os quatro campos
em linhas separadas ficaria em 1317px, e a lista de horários deixaria de caber numa tela.

- **Evento de horário único continua sendo um bloco só.** Título e descrição em branco não aparecem
  em lugar nenhum, então quem cadastra o caso comum não preenche nada além do que preenche hoje.
- "Remover" some quando existe uma sessão só — evento sem nenhum horário não é estado alcançável
  pela tela.
- A ordem na tela **acompanha o horário digitado**: trocar a data reordena o bloco. Não há arrastar.
- Componentes do kit do painel (`Field`, `Input`, `Button`) — `docs/patterns/area-administrativa-visual.md`.
- Os campos continuam `<input type="datetime-local">`, com a conversão de fuso que já existe
  (`paraCampoDeDataHora` / `deCampoDeDataHora` em `src/painel/eventos-api.ts`). **Essa conversão é
  reaproveitada, não reescrita**: ela mede o deslocamento de São Paulo duas vezes por causa do
  horário de verão, e é onde erro de horário costuma nascer.

`EventoEditor.tsx` tem 573 linhas. A lista de sessões sai em componente próprio
(`src/painel/pages/evento/SessoesDoEvento.tsx`), não inline.

### 8.2 Página pública — o cartão "Programação"

Cartão próprio na coluna principal, **logo abaixo de "Sobre o evento"** e com a mesma largura dele
(o bloco de local vive na coluna lateral, e não muda). As sessões vêm **agrupadas por dia**: o dia
por extenso como olho da lista, e uma linha por horário — hora à esquerda, título e descrição à
direita, empilhados em tela estreita.

Agrupar por dia evita repetir "sábado, 14 de março" em duas linhas seguidas, que é o caso comum de
programação de fim de semana.

**Evento de uma sessão só não ganha bloco nenhum** — a data continua no topo, como hoje. O bloco
aparece a partir de duas sessões.

Com duas ou mais, o topo da página passa a mostrar o intervalo ("13 e 14 de março") no lugar do
dia único, e a faixa de horário sai do topo — ela vive na programação. `faixaDeHorario`
(`EventoHero.tsx`) continua servindo cada linha da programação.

### 8.3 Listas

- **Lista pública** (`/eventos`): o cartão mostra `13 e 14 de março · 3 horários`, pelo mesmo
  resumo da §6. Uma sessão só: a data longa de hoje, sem mudança.
- **Lista do painel**: continua mostrando a data derivada do evento (`startsAt`), com `· N horários`
  quando há mais de uma. Os filtros "próximos"/"passados" continuam usando as colunas derivadas, e
  por isso passam a significar "começou" e "acabou" — o que já é o que o usuário do painel espera
  dessas palavras.

---

## 9. O que NÃO quebra

- **Eventos publicados** continuam publicados, com a mesma página, o mesmo link e a mesma arte.
- **Capa, cores, responsável, Open Graph, remoção de fundo**: nada muda. Esta spec não encosta neles.
- **Permissões** (`evento:write`, `evento:publish`) são as mesmas.
- **`startsAt`/`endsAt` continuam na API**, agora derivados. Quem consome não precisa mudar.
- **Contagem regressiva**: a página do evento não tem. A que existe é a do próximo culto, na home,
  que não lê evento nenhum.

---

## 10. Testes

A cobertura do projeto é de **funções puras** (`__tests__/`). Entram:

| O quê | Onde |
|---|---|
| Resumo da programação em uma linha (os quatro formatos da §6) | novo, `__tests__/eventos/programacao.test.ts` |
| Primeira e última sessão, e a próxima pendente dado um instante | idem |
| `.ics` com várias sessões: um `VEVENT` por sessão, `UID` por sessão, rótulo no `SUMMARY` | `__tests__/eventos/ics.test.ts` |
| Publicação sem nenhuma sessão, e sessão com término antes do início | `__tests__/eventos/publish-rules.test.ts` |
| Validação: teto de 20, horários repetidos | novo, junto do schema |
| Ida e volta do campo de data por sessão, com horário de verão | `__tests__/eventos/painel-eventos.test.ts` |

Consulta pública, gravação em transação e as telas são validadas no navegador, como o resto do
módulo — exigiriam Postgres de teste.

## 11. Dívidas registradas

- **Recorrência** continua fora. "Toda quarta por 6 semanas" hoje são 6 blocos digitados. Se
  aparecer com frequência, o conserto é um gerador de sessões no formulário, não modelo novo.
- **Ordenação por subconsulta** (§5.3) é adequada a dezenas de eventos publicados. Se a lista
  crescer muito, a saída é a coluna derivada `proxima_sessao_at`, atualizada por tarefa periódica.

## ONDE FICA

- Migration: `server/migrations/009_evento_sessoes.sql`
- Backend: `server/modules/eventos/` — `dto/evento.dto.ts`, `eventos.repository.ts`,
  `eventos.service.ts`, `eventos.publish-rules.ts`, `eventos.image.ts`
- Front público: `src/schemas/evento.ts`, `src/components/evento/` — `EventoHero.tsx`,
  `EventoRenderer.tsx`, `evento-ics.ts`; `src/pages/Eventos.tsx`
- Painel: `src/painel/eventos-api.ts`, `src/painel/pages/EventoEditor.tsx`,
  `src/painel/pages/evento/SessoesDoEvento.tsx` (novo), `src/painel/pages/EventosLista.tsx`
