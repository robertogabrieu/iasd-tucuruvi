# US-21 — Templates de boletim

**Épico:** Boletim Informativo · **Prioridade:** Should · **Estimativa:** 5 pts

## História

> **Como** Administrador,
> **eu quero** começar um boletim a partir de um template pré-montado,
> **para que** eu produza o boletim semanal recorrente com rapidez e padronização, sem remontar a mesma estrutura toda semana.

## Contexto
O Boletim Informativo segue um formato recorrente (ex.: Avisos, Programação, Aniversariantes, Escala). Um template é um **molde reutilizável** com blocos e textos-guia já posicionados. Vai além do "duplicar um boletim anterior" (US-20): templates são curados e não carregam o conteúdo específico de uma semana.

## Critérios de aceitação

### CA-01 — Criar boletim a partir de template
- **Given** que existe ao menos um template (ex.: "Boletim Semanal Padrão")
- **When** crio um novo boletim e escolho esse template
- **Then** um novo **rascunho** é criado já com os blocos e textos-guia do template
- **And** edito normalmente a partir dali (US-16), sem afetar o template.

### CA-02 — Começar em branco continua disponível
- **Given** a criação de um novo boletim
- **When** escolho "começar do zero"
- **Then** um rascunho vazio é criado, sem template.

### CA-03 — Gerenciar templates
- **Given** que tenho a permissão `bulletins:templates:manage`
- **When** acesso a gestão de templates
- **Then** posso **criar, editar, renomear e remover** templates.

### CA-04 — Salvar um boletim como template
- **Given** um boletim cuja estrutura eu quero reaproveitar
- **When** escolho "salvar como template" e dou um nome
- **Then** um template é criado a partir da estrutura atual de blocos
- **And** posso optar por manter ou limpar os textos/imagens específicos daquela edição (mantendo apenas a estrutura).

### CA-05 — Templates não são públicos
- **Given** um template
- **When** alguém tenta acessá-lo por uma URL pública
- **Then** ele não é acessível: templates existem apenas dentro do painel (não têm slug/link público).

## Notas técnicas (orientação para implementação)
- Reaproveitar a mesma estrutura de blocos (JSON) dos boletins; um template é, em essência, um boletim sem slug/publicação e marcado como `is_template`.
- Evitar duplicar o editor: usar o editor da US-16 para editar templates.
- Guard `bulletins:templates:manage` para gestão; criar a partir de template exige `bulletins:write`.
- Considerar 1 template inicial semeado ("Boletim Semanal Padrão") para uso imediato.

## Dependências
- **US-16** (editor/estrutura de blocos) e **US-20** (criação/listagem de boletins).

## Definição de pronto
- [ ] Criar boletim a partir de template (ou em branco).
- [ ] Criar, editar, renomear e remover templates.
- [ ] Salvar um boletim existente como template (com opção de limpar conteúdo).
- [ ] Templates não expostos publicamente; permissão própria exigida.
