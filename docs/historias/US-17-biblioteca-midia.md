# US-17 — Biblioteca de mídia (upload e reuso de imagens)

**Épico:** Boletim Informativo · **Prioridade:** Must · **Estimativa:** 8 pts

> ✅ **Entregue** em `0b84be9`, `9abd119`, `147f6ee`, `52e88ed`, `dc54f0d` — branch `feat/biblioteca-midia`; CA-04/CA-05 em `08aa088`, `c36df2a`, `ffb64c1` — branch `feat/boletim`. Ver [spec](../superpowers/specs/2026-06-16-biblioteca-midia-design.md) e [plano](../superpowers/plans/2026-06-16-biblioteca-midia.md).

## História

> **Como** Administrador,
> **eu quero** uma biblioteca onde eu faça upload de imagens e as reutilize,
> **para que** eu insira fotos nos boletins sem reenviar o mesmo arquivo toda vez.

## Contexto
A biblioteca é a fonte de imagens do editor de boletim (US-16), mas é pensada para ser **reutilizável** por outras features futuras. Arquivos ficam num volume; a metadata, no Postgres.

## Critérios de aceitação

### CA-01 — Upload de imagem
- **Given** que tenho a permissão `media:manage`
- **When** envio um arquivo de imagem
- **Then** ele é armazenado e passa a aparecer na biblioteca
- **And** registram-se metadados: nome, tipo, tamanho, dimensões e quem enviou.

### CA-02 — Validação de arquivo
- **Given** um arquivo que não é imagem, ou acima do tamanho máximo permitido
- **When** tento enviar
- **Then** o upload é recusado com mensagem clara
- **And** apenas tipos permitidos (ex.: JPEG, PNG, WebP) são aceitos — validados pelo **conteúdo** do arquivo, não só pela extensão.

### CA-03 — Listar e buscar
- **Given** que a biblioteca tem imagens
- **When** a abro
- **Then** vejo as imagens em grade (miniaturas), das mais recentes para as mais antigas
- **And** posso buscar pelo nome.

### CA-04 — Selecionar para uso
- **Given** o editor de boletim (US-16) inserindo um bloco de Imagem
- **When** abro a biblioteca a partir dele
- **Then** posso escolher uma imagem existente e ela é inserida no bloco (referência por id).

### CA-05 — Remover imagem
- **Given** uma imagem na biblioteca
- **When** tento removê-la
- **Then** se ela estiver em uso por algum boletim, sou avisado e a remoção é bloqueada (ou exige confirmação)
- **And** se não estiver em uso, o arquivo e a metadata são removidos.

## Notas técnicas (orientação para implementação)
- Arquivos num **volume Docker** dedicado a uploads (incluir no `docker-compose`); metadata em tabela `media`.
- Nomes de arquivo **sanitizados/aleatorizados** no servidor (evitar path traversal e colisão); nunca confiar no nome original.
- Servir as imagens por uma rota/estática controlada; considerar geração de **miniatura** para a grade.
- Limites (tamanho, tipos) configuráveis; reaproveitar `server/lib/sanitize.ts` onde fizer sentido.
- Guard `media:manage` (US-10).
- Segurança: rejeitar conteúdo executável/SVG com script; validar *magic bytes*.

## Dependências
- Consumida por **US-16** (bloco de Imagem) e **US-19** (capa do boletim).

## Definição de pronto
- [ ] Upload com validação de tipo/tamanho por conteúdo.
- [ ] Listagem em grade com busca por nome.
- [ ] Seleção de imagem existente a partir do editor. *(CA-04 — entregue com o editor (US-16): `MediaPicker` com abas "Biblioteca" e "Enviar" (upload no próprio modal); a imagem é inserida por referência (id).)*
- [ ] Remoção protegida quando a imagem está em uso. *(CA-05 — entregue: o editor registra um usage checker no `MediaService` que varre linhas → colunas → blocos + a imagem de capa; remoção de imagem em uso é bloqueada.)*
- [ ] Arquivos em volume + metadata no banco; permissão `media:manage` exigida.

### Extras de UX entregues (além dos CAs)
- **Modal de detalhes da mídia:** botão "expandir" flutuante no card (visível no hover; em telas touch a miniatura é clicável) abre um modal em 2 colunas — preview maior à esquerda, e à direita os metadados (dimensões, tipo, tamanho, data de envio) + ações **Baixar** (download do original) e **Fechar**.
- **Spinner de carregamento:** na grade durante o fetch (sem flash de estado vazio) e sobre a imagem do modal enquanto ela carrega. Componente `Spinner` adicionado ao kit; `Modal` ganhou prop `size` (`md`/`lg`/`xl`). Ver `docs/patterns/area-administrativa-visual.md`.
