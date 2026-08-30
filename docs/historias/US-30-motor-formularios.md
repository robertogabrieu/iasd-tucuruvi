# US-30 — Motor de formulários: submissões salvas, listadas e exportáveis

**Épico:** Motor de Formulários · **Prioridade:** Must · **Estimativa:** 8 pts

> ⏳ **Pendente** — spec em `docs/superpowers/specs/2026-08-30-motor-formularios-design.md`.

## História

> **Como** secretaria da igreja,
> **eu quero** que todo formulário do site guarde o que as pessoas enviam e me mostre isso numa tela com filtro e exportação,
> **para que** nenhum pedido de contato se perca e eu consiga trabalhar a lista sem depender de quem programa.

## Contexto

Hoje existe um único formulário público — Estudos Bíblicos — e ele **não guarda nada**: monta um
e-mail e envia. Se o envio falha, o pedido desaparece sem deixar rastro, e é por isso que a seção
está oculta no site. Também não há tela nenhuma para consultar o que já chegou.

Formulários novos vão aparecer (inscrição em evento, contato de departamento, voluntariado) e cada
um terá campos diferentes. O motor precisa absorver todos eles **sem tabela nova, sem tela nova e
sem exportação nova** — só o arquivo de definição do formulário.

## Critérios de aceitação

### CA-01 — Toda submissão fica salva
- **Given** um formulário público do site
- **When** alguém preenche e envia
- **Then** a submissão é gravada no banco antes de qualquer outra coisa
- **And** o aviso por e-mail é tentado depois, e **falhar não invalida o envio** — quem preencheu
  recebe a confirmação normalmente.

### CA-02 — Validação a partir da definição
- **Given** a definição de um formulário (campos, tipos, obrigatoriedade)
- **When** chega uma submissão com campo obrigatório vazio, tipo inválido ou campo desconhecido
- **Then** o envio é recusado com erro de validação
- **And** o campo-armadilha anti-robô e o limite de envios por IP continuam valendo.

### CA-03 — Listar submissões
- **Given** que tenho a permissão `forms:read`
- **When** abro um formulário no painel
- **Then** vejo as submissões da mais recente para a mais antiga, paginadas
- **And** as colunas são as que a definição daquele formulário marca como destaque, no máximo quatro
- **And** vejo se o aviso por e-mail saiu ou falhou.

### CA-04 — Ver uma submissão inteira
- **Given** a listagem de um formulário
- **When** abro uma linha
- **Then** vejo **todos** os campos preenchidos, na ordem do formulário, com os rótulos que a pessoa viu
- **And** vejo quando chegou e a situação do aviso por e-mail.

### CA-05 — Filtrar
- **Given** a listagem de um formulário
- **When** uso a busca livre, o período (de/até) ou um dos seletores de campo de escolha
- **Then** a lista mostra apenas as submissões correspondentes
- **And** os filtros ficam no endereço da página — recarregar, voltar ou enviar o link preserva o filtro
- **And** os seletores exibidos são só os que aquele formulário tem.

### CA-06 — Exportar
- **Given** que tenho a permissão `forms:export`
- **When** clico em Exportar
- **Then** baixo um arquivo `.csv` com **todos** os campos do formulário, não só as colunas da tela
- **And** o arquivo contém exatamente o conjunto filtrado na tela, não a base inteira
- **And** abre no Excel em português com a acentuação correta.

### CA-07 — Estados da tela
- **Given** um formulário sem nenhuma submissão
- **When** abro a tela
- **Then** vejo uma mensagem dizendo que ainda não chegou nenhum envio
- **And** se o vazio for consequência do filtro, a mensagem é outra e oferece limpar o filtro
- **And** enquanto carrega vejo o indicador de carregamento, não o estado vazio piscando.

### CA-08 — Formulário novo entra sozinho
- **Given** um formulário novo declarado no catálogo
- **When** o servidor sobe
- **Then** ele aparece no índice de formulários do painel, com listagem, filtros e exportação
  funcionando, **sem nenhuma alteração nas telas do painel**
- **And** se a definição for inválida (sem opções num campo de escolha, mais de quatro colunas de
  destaque, chave repetida), o servidor recusa subir com mensagem apontando o erro.

## Fora do escopo

- Acompanhar atendimento (situação da submissão, anotação interna) — decidido: tela é **somente leitura**.
- Excluir submissão pelo painel / atender pedido de eliminação de dados (LGPD).
- Construtor visual de formulários no painel.
- Renderizar o formulário público a partir da definição — cada formulário do site continua sendo
  uma peça de design própria.
