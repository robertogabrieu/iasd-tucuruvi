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
| 7 | O que a arte de compartilhamento mostra | O resumo em cascata: **as horas enquanto couberem**, depois o intervalo de dias. §6. |
| 8 | O que o convite de calendário baixa | **Um compromisso por sessão**, em um arquivo só, com identificador calculado. §7. |
| 9 | Dois editores ao mesmo tempo | A gravação é **recusada** se o evento mudou desde que o formulário abriu. §5.1. |
| 10 | Onde a programação entra na página | **Antes** da descrição, quando há mais de um horário. §8.2. |

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
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evento_sessoes_termino_depois CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX idx_evento_sessoes_evento ON evento_sessoes (evento_id, starts_at);
CREATE UNIQUE INDEX idx_evento_sessoes_instante ON evento_sessoes (evento_id, starts_at);
```

O `CHECK` vale pelo mesmo motivo do índice único: término antes do início é erro de digitação em qualquer
caminho de gravação, e hoje essa regra só existe na hora de publicar — um rascunho pode carregá-la
por semanas.

`ON DELETE CASCADE`: apagar o evento apaga a programação — sessão não existe fora do evento.

O índice único sobre `(evento_id, starts_at)` recusa duas sessões no mesmo instante. Programação
com dois horários idênticos é erro de digitação, não intenção, e é mais barato barrar no banco do
que descobrir depois pela página publicada.

**Não há coluna de ordem.** A programação é sempre cronológica, calculada por `starts_at`.

### 4.2 Campos da sessão

| Campo | Tipo | Rótulo na tela | Regra |
|---|---|---|---|
| `startsAt` | data e hora | Início | Obrigatório. |
| `endsAt` | data e hora | Término (opcional) | Opcional, como no evento hoje. Se existir, precisa ser depois do início. |
| `title` | texto até 120 | Nome deste horário | Opcional. "Abertura", "Escola Sabatina especial". |
| `description` | texto até 500 | Uma frase sobre este horário | Opcional. **Texto simples**, não editor rico. |

Os rótulos são parte da decisão, não enfeite: "Título" e "Descrição" já existem no cartão de cima,
para o evento inteiro. Repetidos dentro do bloco, levam a preencher o nome do evento em cada
horário — o erro mais provável desta tela.

`description` é texto simples de propósito: três sessões com editor rico cada uma transformam o
formulário numa página de blocos e a programação numa parede de texto. O texto longo continua
cabendo na descrição do evento, que aparece acima da programação.

**Até 20 sessões por evento**, validado no schema de entrada. O teto impede que uma lista
digitada em loop estoure a página e a geração das artes. **O piso de 1 vale na publicação**, não na
gravação: um evento publicado sem programação sairia da lista pública continuando a abrir pelo link,
com a data antiga. Por isso publicar, e salvar um evento que já está no ar, exigem pelo menos um
horário (§5.4). Rascunho pode ser salvo sem horário nenhum (§4.5). Nesse caso `starts_at` fica com
o valor provisório da criação e `ends_at` fica nulo, e nenhuma tela pública lê esse cache de um
rascunho.

### 4.3 As colunas de data do evento passam a ser derivadas

`eventos.starts_at` e `eventos.ends_at` **continuam existindo** e param de ser digitadas:

- `starts_at` = início da **primeira** sessão.
- `ends_at` = término da **última** sessão — `null` se a última sessão não tiver término.

O servidor reescreve as duas a cada gravação da programação. Elas sobrevivem porque alimentam o
filtro de próximos/passados do painel, a ordenação da lista administrativa e o índice
`idx_eventos_status_starts` que já existe. `starts_at` continua `NOT NULL`.

A API continua entregando `startsAt`/`endsAt` **na resposta**, e passa a entregar também `sessions`.
Quem lê uma data única (a arte, a lista do painel) não precisa mudar de campo; quem precisa da
programação lê `sessions`. **A fonte da verdade é `sessions`** — as duas colunas são cache.

**Os dois campos saem dos schemas de escrita** (`createEventoSchema`, `updateEventoSchema` e o
`paraApi` do painel). Enquanto a API aceitar `startsAt` na gravação, um envio com data e sem
programação — o formulário antigo em cache do navegador, um script, uma integração — reescreve o
cache com um valor que nenhuma sessão sustenta, e as duas listas passam a discordar uma da outra
sem erro nenhum aparecer.

### 4.4 Migração do que já existe

A mesma migration copia cada evento para uma sessão única, sem rótulo e sem descrição:

```sql
INSERT INTO evento_sessoes (evento_id, starts_at, ends_at)
SELECT id, starts_at,
       CASE WHEN ends_at > starts_at THEN ends_at END
FROM eventos;
```

O `CASE` existe porque **rascunho pode ter término anterior ao início hoje** — a regra só é cobrada
na publicação, e a tabela de eventos não tem restrição nenhuma. Copiado como está, o dado violaria o
`CHECK` novo e a migration derrubaria o boot; copiado assim, o rascunho perde só o término inválido
e volta a ser salvável.

Evento que já existe vira, sozinho, um evento de uma sessão. Nada muda na tela dele: sessão sem
rótulo em programação de uma linha só não renderiza cartão nenhum (§8.2).

Rodar a migration duas vezes não duplica nada: o runner grava cada arquivo em `schema_migrations`
dentro da mesma transação do SQL (`server/core/db.ts`).

### 4.5 Rascunho recém-criado

Rascunho nasce hoje com `starts_at = now()` porque a coluna é `NOT NULL` e o formulário pode nascer
pela metade (`EventosService.create`). O rascunho **nasce sem sessão nenhuma**, e o formulário abre
com um bloco de horário vazio. Revisto depois de ver a tela pronta: com a data de hoje já
preenchida, o campo parecia um horário escolhido, e quem cadastra podia publicar sem perceber que
não o trocou. Bloco totalmente vazio é ignorado ao salvar. Assim o rascunho guarda título,
descrição e o resto sem que um horário ainda em branco impeça. No painel, o evento sem horário
aparece como "Sem horário" e fica em "próximos", porque ainda é trabalho a fazer.

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
já usa para campo não informado. Ids de sessão enviados no pedido são **ignorados**: a lista chega
como conteúdo, não como referência.

Depois de gravar, e na mesma transação, o servidor recalcula `starts_at`/`ends_at` do evento (§4.3).
A regeração das artes continua onde está, no fim do `update`.

**Toda leitura de evento carrega as sessões** — por id, por slug, a lista do painel, a lista pública
e o caminho que regera a arte quando o arquivo sumiu do disco. Uma leitura que esquecer disso falha
em silêncio e diferente em cada tela: a página abre sem programação, a arte regerada volta com a
data de um horário só.

Formato de `sessions` na resposta: `{ id, startsAt, endsAt, title, description }`, **sempre em ordem
cronológica, ordenada pelo servidor**. Nenhuma tela reordena.

**Duas pessoas editando o mesmo evento.** O `PATCH` leva o `updatedAt` que o formulário carregou, e
a gravação é recusada se ele não for o do banco — com a mensagem "alguém salvou este evento antes de
você; recarregue a página". Sem isso, a substituição integral faz quem salva por último apagar a
programação inteira do outro: hoje o mesmo descuido perderia um campo de data, agora perde a lista
de horários toda.

### 5.2 Validação

No schema Zod (`server/modules/eventos/dto/evento.dto.ts` e o espelho em `src/schemas/evento.ts`):
cada sessão precisa de `startsAt`; `endsAt`, quando presente, precisa ser depois do início; até
20 sessões, com a lista vazia aceita no rascunho e o piso de 1 cobrado na publicação (§5.4); instantes de início não se repetem dentro do mesmo evento.

O choque de horário é validado **nos três lugares**: no formulário antes de enviar, no schema, e no
índice único. O primeiro existe porque a tela tem a lista inteira em mãos e pode apontar **os dois
blocos em conflito**; sem ele, a recusa do servidor chega como faixa genérica no topo e, com oito
horários, ninguém acha o par repetido — e, como a gravação é integral, nada mais do formulário é
salvo junto.

Toda mensagem de erro de sessão nomeia **a posição e o horário** ("2º horário — sábado, 14 de
março"). Mensagem que não diz qual horário obriga a conferir um por um.

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
) ASC, e.id ASC
```

O desempate por `id` evita que dois eventos no mesmo horário troquem de lugar a cada recarga.

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
- Término antes ou igual ao início: **"No 2º horário, o término precisa ser depois do início."**

**A regra precisa receber a programação efetiva.** Ela roda também ao salvar um evento já publicado,
para impedir que ele fique incompleto, e monta o estado a partir do evento lido do banco somado ao
que veio no pedido. Como o `PATCH` pode não trazer `sessions` (trocar só o título), a lista tem de
vir do banco nesse caso — senão editar o título de um evento no ar passa a ser recusado com
"Informe pelo menos um horário", e o evento fica intocável.

**As frases são o endereço da correção.** O painel decide para qual cartão a mensagem leva
procurando trechos fixos dentro dela (`src/painel/eventos-api.ts`), e nenhum dos trechos de hoje
casa com as frases novas — sem atualizar esse mapa, o clique na pendência de horário leva para o
cartão "Sobre o evento". Entra no escopo, coberto pelo teste que já roda sobre as frases reais.

Rótulo de sessão continua opcional mesmo com várias sessões: programação de fim de semana que só
lista dia e hora é legítima.

---

## 6. As artes de compartilhamento

`quandoPorExtenso` (`eventos.image.ts`) monta hoje uma linha: "Sábado, 26 de setembro · 19h30".
Passa a resumir a programação inteira, ainda em **uma linha**:

O resumo é montado **em cascata**: vale a forma mais informativa que couber em **36 caracteres**, e
só então a seguinte.

| Programação | Texto | Tamanho |
|---|---|---|
| Uma sessão | `Sábado, 26 de setembro · 19h30` — igual a hoje | 30 |
| Até 3 no mesmo dia | `26 de setembro · 9h30, 14h e 19h30` | 34 |
| Até 3 em dias seguidos | `13 e 14 de março · 3 horários` | 29 |
| 4 ou mais, mesmo mês | `13 a 15 de março · 6 horários` | 29 |
| Meses diferentes | `27 de fev a 2 de mar · 8 horários` | 33 |

**Horário some é horário perdido.** Com vários horários no mesmo dia, a forma que diz só "3
horários" tira da lista e da arte a única informação que faz alguém decidir se dá para ir — e a arte
é o que a maioria vê, porque chega pelo WhatsApp sem ninguém abrir o link. Por isso as horas ficam
enquanto couberem.

**O limite de 36 não é estimativa.** A linha do "quando" é desenhada como um `<text>` único, sem
quebra e sem corte (`eventos.image.styles.ts`), e a sobra é pintada por cima da foto no cartão
1200×630 ou sai do quadro no story 1080×1920. Pela métrica que o próprio módulo usa para quebrar
texto, cabem ~37 caracteres no story e ~36 na coluna de texto do cartão. O texto passa pela mesma
função de quebra, com teto de uma linha e reticências, como rede — a cascata é que evita chegar lá.

**Tudo em `America/Sao_Paulo`.** Dia, intervalo e agrupamento são calculados no fuso da igreja, não
no do servidor: nem o `docker-compose.yml` nem o `Dockerfile` definem fuso, então o processo roda em
UTC, e uma vigília de sexta às 21h cairia no sábado — a arte anunciaria dois dias onde há um.

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

- `UID` = `<id do evento>-<posição cronológica>@iasdtucuruvi.org.br`, e o **primeiro horário mantém o
  identificador que o evento tem hoje** (`<id do evento>@…`). Precisa ser calculado, não o id da
  sessão: a programação é apagada e regravada a cada salvamento (§5.1), então o id da sessão muda
  sozinho, e quem já tinha o evento na agenda ganharia um compromisso duplicado a cada edição — e
  outro logo depois da migração, por causa da mudança de identificador.
- `SEQUENCE` sobe a cada salvamento. É o contador que faz o calendário aceitar a alteração de um
  compromisso que ele já tem, em vez de ignorá-la.
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
  Este evento já está no ar — alterar a programação muda a
  página e a arte já compartilhada.        (só se publicado)

Local    [Salão principal — IASD Tucuruvi]
Endereço [R. Cruz de Malta, 1201        ]  vale para todos os horários
────────────────────────────────────────────────────────────
┌──────────────────────────────────────────────────────────┐
│ Sexta, 13 de março · 20h00                     [Remover] │
│ Início [13/03 20:00] Término [21:30] Nome [Abertura    ] │
│ Uma frase sobre este horário [                         ] │
└──────────────────────────────────────────────────────────┘
  Em branco, a programação mostra só o horário.
                                       [+ Adicionar horário]
```

O cabeçalho de cada bloco repete, por extenso, o que foi digitado ("Sexta, 13 de março · 20h00"):
data errada aparece como dia da semana errado antes de publicar, não depois.

Início, término e título dividem uma linha de três colunas em tela larga, e empilham no celular.
Medido no mockup: o cartão inteiro com três horários fica em 1071px de altura; com os quatro campos
em linhas separadas ficaria em 1317px, e a lista de horários deixaria de caber numa tela.

**Local e endereço vêm antes da lista**, não depois. Eles valem para o evento inteiro; a lista é o
detalhe. Com 12 horários, dois campos no fim do cartão ficam a milhares de pixels do título — e é
justamente o cartão onde a pessoa vai procurar por "Quando **e onde**".

- **Evento de horário único continua sendo um bloco só.** Nome e frase em branco não aparecem em
  lugar nenhum, então quem cadastra o caso comum não preenche nada além do que preenche hoje. Uma
  linha de auxílio embaixo do primeiro bloco diz isso: "Em branco, a programação mostra só o horário."
- **A ordem acompanha o horário digitado, mas só quando o campo perde o foco.** Reordenar durante a
  digitação faz o bloco sair debaixo do cursor: o campo de data dispara a cada pedaço digitado (dia,
  mês, ano) e a lista se remonta três vezes no meio de uma correção. Não há arrastar.
- **O horário novo nasce no fim da lista**, vazio e com o foco no campo de início. Nascer já
  ordenado o colocaria no meio, fora da tela, longe do botão que a pessoa acabou de tocar.
- **Remover não apaga na hora.** O bloco dá lugar a "Horário removido · Desfazer" por alguns
  segundos. São três blocos iguais com o mesmo botão vermelho na mesma posição; no celular, o toque
  errado hoje destruiria nome e frase já digitados, e a única recuperação seria sair sem salvar —
  jogando fora o formulário inteiro.
- **Horário repetido é marcado nos dois blocos**, com a mensagem embaixo do campo de início, antes
  de enviar (§5.2).
- **Evento já publicado avisa**, numa linha no topo do cartão: "Este evento já está no ar — alterar
  a programação muda a página e a arte já compartilhada." Remover o horário de sexta de um evento
  divulgado muda a página, regera a arte e deixa quem já salvou o convite com um compromisso que não
  existe mais; a tela não pode tratar isso como edição de rascunho.
- **Cada bloco é um grupo nomeado** ("Horário 2 de 3 — sábado, 14 de março") e **cada rótulo é ligado
  ao seu campo**. Com oito blocos, um leitor de tela anuncia hoje "Início, Término, Nome" oito vezes
  iguais, sem dizer de qual horário; e clicar no rótulo não foca o campo. O componente de campo do
  projeto já aceita a ligação — nem o formulário atual a usa.
- **As três colunas só a partir de 768px.** A 640px cada coluna fica com ~175px e o seletor nativo
  de data e hora corta o valor — justo o campo que a pessoa precisa conferir.
- Componentes do kit do painel (`Field`, `Input`, `Button`) — `docs/patterns/area-administrativa-visual.md`.
- Os campos continuam `<input type="datetime-local">`, com a conversão de fuso que já existe
  (`paraCampoDeDataHora` / `deCampoDeDataHora` em `src/painel/eventos-api.ts`). **Essa conversão é
  reaproveitada, não reescrita**: ela mede o deslocamento de São Paulo duas vezes por causa do
  horário de verão, e é onde erro de horário costuma nascer.
- As pendências de publicação continuam onde já estão hoje: **faixa larga logo abaixo do cabeçalho**
  da página, não na coluna lateral — no celular, a lateral empilha depois de todos os cartões, e a
  mensagem de erro apareceria a duas telas de rolagem do botão que a causou.

`EventoEditor.tsx` tem 573 linhas. A lista de sessões sai em componente próprio
(`src/painel/pages/evento/SessoesDoEvento.tsx`), não inline.

### 8.2 Página pública — o cartão "Programação"

Cartão próprio na coluna principal, com a mesma largura de "Sobre o evento" (o bloco de local vive
na coluna lateral, e não muda). As sessões vêm **agrupadas por dia**: o dia por extenso como olho da
lista, e uma linha por horário — hora à esquerda, nome e frase à direita, empilhados em tela
estreita.

Agrupar por dia evita repetir "sábado, 14 de março" em duas linhas seguidas, que é o caso comum de
programação de fim de semana.

**Com dois ou mais horários, a programação vem antes de "Sobre o evento".** É a informação que o
visitante veio buscar: ele chega pelo WhatsApp, no celular, querendo saber se consegue ir no sábado.
Depois do retrato do responsável e do cartão de descrição inteiro, a resposta fica a duas ou três
rolagens da pergunta.

**O topo leva até lá.** "3 horários · veja a programação" é um link para a âncora do cartão, não
texto morto mandando procurar.

**Hierarquia:** o dia comanda o grupo — maior e mais pesado que as linhas que agrupa. Dentro da
linha, só a hora fica em negrito; o nome do horário vai em peso normal. Hoje hora e nome teriam
exatamente o mesmo peso, tamanho e cor, e o dia seria o menor texto do cartão: o olho não encontra
por onde a pessoa procura. No celular, hora e nome ganham um respiro entre si, em vez dos 2px que os
fundem num bloco só.

**Evento de uma sessão só não ganha bloco nenhum** — a data continua no topo, como hoje. O bloco
aparece a partir de duas sessões.

Com duas ou mais, o topo da página passa a mostrar o intervalo ("13 e 14 de março") no lugar do
dia único, e a faixa de horário sai do topo — ela vive na programação. `faixaDeHorario`
(`EventoHero.tsx`) continua servindo cada linha da programação.

### 8.3 Listas

- **Lista pública** (`/eventos`): o cartão mostra o resumo da §6. Uma sessão só: a data longa de
  hoje, sem mudança.
- **Os outros dois textos que dizem a data** entram no mesmo resumo: o cartão "Adicionar à agenda"
  ("Salve a data no calendário do celular: …") e a mensagem que vai para o WhatsApp
  (`src/components/evento/EventoRenderer.tsx`, `src/painel/eventos-api.ts`). Sem eles, um evento de
  sexta a domingo continua sendo divulgado como se fosse só a sexta.
- **Lista do painel**: mostra a data derivada do evento (`startsAt`), com `· N horários` quando há
  mais de uma. Os filtros **"próximos" e "passados" passam a usar o mesmo critério da lista
  pública** — ainda tem horário por vir, ou já acabou. Mantê-los na data de início faria um evento
  de sexta a domingo aparecer em "passados" no sábado de manhã, enquanto o site público ainda o
  lista como próximo: duas listas do mesmo sistema discordando.

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
| Resumo da programação: as cinco formas da §6, e que **nenhuma passa de 36 caracteres** | novo, `__tests__/eventos/programacao.test.ts` |
| Resumo e agrupamento de uma sessão às 21h **não viram o dia seguinte** (fuso da igreja, servidor em UTC) | idem |
| Primeira e última sessão, e a próxima pendente dado um instante | idem |
| `.ics`: um `VEVENT` por sessão; `UID` **estável entre dois salvamentos**; o primeiro horário mantém o `UID` de hoje; `SEQUENCE` sobe | `__tests__/eventos/ics.test.ts` |
| Publicação sem nenhuma sessão; término antes do início citando **qual** horário; evento publicado editado **sem** `sessions` no pedido continua publicável | `__tests__/eventos/publish-rules.test.ts` |
| Cada frase nova de pendência leva ao cartão "Quando e onde" | `__tests__/eventos/painel-eventos.test.ts` |
| Validação: lista vazia aceita (rascunho sem horário), teto de 20, horários repetidos | novo, junto do schema |
| Ida e volta do campo de data por sessão, com horário de verão | `__tests__/eventos/painel-eventos.test.ts` |

Consulta pública, gravação em transação e as telas são validadas no navegador, como o resto do
módulo — exigiriam Postgres de teste.

## 11. Dívidas registradas

- **Recorrência** continua fora. "Toda quarta por 6 semanas" hoje são 6 blocos digitados. Se
  aparecer com frequência, o conserto é um gerador de sessões no formulário, não modelo novo.
- **Ordenação por subconsulta** (§5.3) é adequada a dezenas de eventos publicados. Se a lista
  crescer muito, a saída é a coluna derivada `proxima_sessao_at`, atualizada por tarefa periódica.
- **O cabeçalho do editor não cabe no celular.** Medido no mockup: com quatro ações (rascunho,
  pré-visualizar, publicar, salvar) a barra estoura os 400px. É **pré-existente** — vem do cabeçalho
  padrão do painel, não desta mudança — e fica fora do escopo. Conserto natural: deixar as ações
  quebrarem linha.
- **Botão pequeno do kit tem 34px de altura**, abaixo do alvo de toque confortável (44px). Como
  "Remover" é destrutivo, repetido e tocado no celular, ele usa aqui o tamanho médio do kit (38px).
  Subir o mínimo do kit inteiro é decisão de outra mudança.

## ONDE FICA

- Migration: `server/migrations/009_evento_sessoes.sql`
- Backend: `server/modules/eventos/` — `dto/evento.dto.ts`, `eventos.repository.ts`,
  `eventos.service.ts`, `eventos.publish-rules.ts`, `eventos.image.ts`
- Front público: `src/schemas/evento.ts`, `src/components/evento/` — `EventoHero.tsx`,
  `EventoRenderer.tsx`, `evento-ics.ts`; `src/pages/Eventos.tsx`
- Painel: `src/painel/eventos-api.ts`, `src/painel/pages/EventoEditor.tsx`,
  `src/painel/pages/evento/SessoesDoEvento.tsx` (novo), `src/painel/pages/EventosLista.tsx`
