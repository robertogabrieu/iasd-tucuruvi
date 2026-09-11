# US-16 — Editor de boletim (blocos)

**Épico:** Boletim Informativo · **Prioridade:** Must · **Estimativa:** 8 pts

> ✅ **Entregue** em `1752a0a`, `7111bd6`, `f34f7da`, `34551eb`, `eb38363` — branch `feat/boletim`. Ver [spec](../superpowers/specs/2026-06-16-boletim-editor-publicacao-design.md) e [plano](../superpowers/plans/2026-06-16-boletim.md).

## História

> **Como** Administrador,
> **eu quero** montar um Boletim Informativo empilhando blocos de título, texto e imagem,
> **para que** eu produza o conteúdo semanal de forma estruturada, sem depender de quem programa.

## Contexto
O Boletim é o artigo semanal compartilhado no grupo de WhatsApp. O conteúdo é composto por **blocos discretos** ordenados, salvos como uma estrutura (JSON) no banco. Esta história cobre **criar e editar** o conteúdo; publicação é a **US-18**, imagens vêm da **US-17**.

## Critérios de aceitação

### CA-01 — Criar um novo boletim
- **Given** que tenho a permissão `bulletins:write`
- **When** crio um novo boletim e informo um **título**
- **Then** um boletim é criado no estado **rascunho** (ver **US-18**)
- **And** posso começar a adicionar blocos.

### CA-02 — Adicionar blocos
- **Given** um boletim aberto no editor
- **When** clico em "adicionar bloco"
- **Then** posso inserir blocos dos tipos: **Título**, **Texto**, **Imagem**, **Galeria** e **Vídeo**
- **And** o bloco entra na posição escolhida da sequência.

### CA-03 — Editar conteúdo do bloco
- **Given** um bloco de Texto ou Título
- **When** edito seu conteúdo
- **Then** o texto é atualizado (Texto admite formatação básica: negrito, itálico, listas e links)
- **And** um bloco de Imagem permite escolher uma imagem da **biblioteca de mídia** (US-17) e um texto alternativo.

### CA-04 — Reordenar e remover blocos
- **Given** um boletim com vários blocos
- **When** movo um bloco para cima/baixo ou o removo
- **Then** a ordem é atualizada e refletida na pré-visualização e no conteúdo salvo.

### CA-05 — Metadados para compartilhamento
- **Given** o boletim em edição
- **When** preencho os campos de **resumo** e **imagem de capa**
- **Then** eles são salvos e servirão ao cartão de preview do WhatsApp (US-19)
- **And** se eu não informar capa, a primeira imagem do conteúdo é sugerida como capa.

### CA-06 — Salvar rascunho
- **Given** alterações no editor
- **When** salvo
- **Then** o conteúdo (sequência de blocos + metadados) é persistido como **JSON** no banco
- **And** posso fechar e retomar a edição depois sem perder nada.

### CA-07 — Validação
- **Given** um boletim sem título ou sem nenhum bloco
- **When** tento salvar
- **Then** recebo mensagem de validação indicando o que falta.

### CA-08 — Bloco de Galeria
- **Given** um bloco de **Galeria**
- **When** o configuro
- **Then** posso selecionar **várias** imagens da biblioteca (US-17) e organizá-las
- **And** a galeria é exibida em grade responsiva, mantendo a identidade visual do site (sem o autor mexer em CSS).

### CA-09 — Bloco de Vídeo (YouTube)
- **Given** um bloco de **Vídeo**
- **When** colo o link de um vídeo do YouTube
- **Then** o vídeo é incorporado de forma responsiva no boletim
- **And** links inválidos/não suportados são recusados com mensagem clara.

## Notas técnicas (orientação para implementação)
- Conteúdo persistido como **JSONB** em `bulletins.content` (lista ordenada de blocos com `type` e `props`).
- Schema dos blocos validado com Zod (client + server em sincronia).
- Bloco de Imagem referencia um item da biblioteca por id (US-17), não duplica o arquivo.
- Bloco de **Galeria** referencia uma lista de ids da biblioteca (US-17); renderização em grade responsiva.
- Bloco de **Vídeo** guarda apenas o id/URL do YouTube e reaproveita a integração de embed já existente (`server/lib/youtube.ts` / componentes de vídeo do site). Sem upload de vídeo.
- Editor reutiliza a paleta/tipografia do site; pré-visualização usa o mesmo *renderer* da página pública (US-19) para fidelidade.
- Guard `bulletins:write` (US-10).

## Dependências
- **US-17** (biblioteca de mídia) para o bloco de Imagem.
- **US-18** (publicação) consome o conteúdo salvo aqui.

## Definição de pronto
- [ ] Adicionar, editar, reordenar e remover blocos (Título, Texto, Imagem, Galeria, Vídeo).
- [ ] Galeria com múltiplas imagens em grade responsiva; Vídeo do YouTube incorporado.
- [ ] Resumo e imagem de capa salvos.
- [ ] Conteúdo persistido como JSON e recuperável para reedição.
- [ ] Permissão `boletim:write` exigida.

> **Nota de implementação:** o modelo de conteúdo evoluiu além da lista plana do spec original para uma estrutura **linhas → colunas → blocos** (cada linha tem 1–4 colunas; cada coluna empilha blocos), com drag-and-drop multi-container (dnd-kit) entre quaisquer colunas/linhas + fallback de botões. O bloco de Texto (TipTap) ganhou um seletor de estilo **Parágrafo / Título 1 / 2 / 3** além da formatação básica.
