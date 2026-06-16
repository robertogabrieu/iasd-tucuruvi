# US-22 — Encurtador/redirecionador de links próprio

**Épico:** Redirecionamento de Links · **Prioridade:** Should · **Estimativa:** 5 pts

## História

> **Como** Administrador,
> **eu quero** criar links curtos no domínio da igreja que redirecionam para endereços externos,
> **para que** eu compartilhe links externos com os membros de forma confiável — eles reconhecem e confiam por estar no nosso domínio.

## Contexto
Em vez de mandar um `bit.ly` ou uma URL longa e suspeita, o admin gera um link como `iasdtucuruvi.com.br/l/inscricao-retiro` que redireciona para o destino externo. A confiança vem de o link ser do **domínio oficial** da igreja.

## Critérios de aceitação

### CA-01 — Criar um link de redirecionamento
- **Given** que tenho a permissão `links:manage`
- **When** informo a **URL de destino** (externa) e, opcionalmente, um **slug personalizado**
- **Then** um link curto é criado no domínio do sistema
- **And** se eu não informar slug, o sistema **gera um código curto** automaticamente.

### CA-02 — Slug personalizado válido e único
- **Given** que escolho um slug personalizado (ex.: `inscricao-retiro`)
- **When** salvo
- **Then** o slug é validado (apenas letras, números e hífens) e precisa ser **único**
- **And** slugs que colidem com rotas existentes do site (ex.: `admin`, `sermoes`, `galeria`, `boletins`, `api`, `l`) são **rejeitados**.

### CA-03 — Validação da URL de destino
- **Given** uma URL de destino
- **When** salvo
- **Then** somente esquemas **http/https** são aceitos
- **And** esquemas perigosos (`javascript:`, `data:`, etc.) são rejeitados.

### CA-04 — Redirecionamento imediato
- **Given** um link ativo `…/l/:slug`
- **When** alguém o acessa
- **Then** é redirecionado **na hora** para a URL de destino (HTTP 302), sem página intermediária.

### CA-05 — Slug inexistente ou desativado
- **Given** um slug que não existe ou um link **desativado**
- **When** alguém o acessa
- **Then** recebe uma página de "link não encontrado/indisponível" (não redireciona).

### CA-06 — Contagem de cliques
- **Given** um link ativo
- **When** ele é acessado
- **Then** o contador de cliques é incrementado e a data do **último acesso** é registrada
- **And** vejo essas métricas na listagem (US-22 abaixo).

### CA-07 — Gerenciar links
- **Given** que tenho `links:manage`
- **When** acesso a lista de links
- **Then** vejo todos com destino, slug, cliques e último acesso
- **And** posso **editar o destino**, **ativar/desativar**, **copiar o link** e **excluir**.

### CA-08 — Expiração (opcional — Could)
- **Given** que defino uma data de expiração para um link
- **When** essa data passa
- **Then** o link deixa de redirecionar (comporta-se como desativado).

## Notas técnicas (orientação para implementação)
- Rota pública curta sugerida: `GET /l/:slug` → 302. Reservar esse prefixo e bloquear colisão de slugs com rotas existentes.
- Tabela `short_links`: `slug` (único), `target_url`, `active`, `click_count`, `last_accessed_at`, `expires_at?`, `created_by`.
- Geração de slug automático curto (base62) com checagem de colisão.
- **Atenção a open redirect**: o redirecionamento é intencional, mas restringir a http/https e registrar quem criou cada link mitiga abuso; nunca redirecionar para esquemas executáveis.
- Incremento de cliques não deve atrasar o redirect (atualização leve/assíncrona).
- Guard `links:manage` (US-10).

## Dependências
- **US-10** (autorização por permissão).

## Definição de pronto
- [ ] Criar link com slug personalizado ou automático, único e validado.
- [ ] URL de destino restrita a http/https.
- [ ] Redirecionamento 302 imediato; slug inexistente/desativado mostra página de indisponível.
- [ ] Contagem de cliques + último acesso, visíveis na listagem.
- [ ] Editar/ativar-desativar/copiar/excluir; permissão `links:manage` exigida.
