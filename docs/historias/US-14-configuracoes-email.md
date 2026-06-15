# US-14 — Tela de configurações (e-mail do sistema)

**Épico:** Interface do Painel · **Prioridade:** Should · **Estimativa:** 5 pts

> ✅ **Entregue** em `bc67dda`, `b043b78`, `85e8573`, `fa6ff42`, `38124ad` — branch `feat/area-administrativa`. Ver [spec](../superpowers/specs/2026-06-15-painel-config-crypto-design.md) e [plano](../superpowers/plans/2026-06-15-painel-config-crypto.md).

## História

> **Como** Administrador,
> **eu quero** uma tela de configurações onde eu gerencie os parâmetros de e-mail do sistema,
> **para que** eu ajuste o envio de e-mails (recuperação de senha, convites) sem depender de redeploy ou de mexer em variáveis de ambiente.

## Contexto
Esta é a **primeira aba** de uma tela de configurações pensada para crescer: o layout usa **abas verticais** e, no futuro, novas abas (ex.: segurança, integrações, aparência) entrarão sem rever a estrutura. Hoje, apenas a aba **E-mail** está ativa.

## Critérios de aceitação

### CA-01 — Layout de abas verticais extensível
- **Given** que acesso a tela de Configurações
- **When** a tela carrega
- **Then** vejo uma navegação de **abas verticais** à esquerda e o conteúdo da aba selecionada à direita
- **And** a aba **E-mail** está presente e selecionada por padrão
- **And** a estrutura comporta novas abas futuramente sem quebrar o layout.

### CA-02 — Carregar configuração atual
- **Given** que a aba E-mail está aberta
- **When** o formulário carrega
- **Then** ele é preenchido com a configuração de e-mail vigente (host, porta, remetente, destinatário, TLS/segurança e, se houver, usuário de autenticação)
- **And** o campo de **senha SMTP** nunca é exibido preenchido (somente-escrita): aparece em branco com indicação de que já existe um valor salvo.

### CA-03 — Persistência no banco
- **Given** que edito os campos e salvo
- **When** a gravação ocorre
- **Then** os valores são persistidos no **banco de dados** (não no `.env`)
- **And** passam a valer **sem reiniciar** o serviço
- **And** as variáveis de ambiente (`SMTP_*`) servem apenas como **fallback inicial** quando ainda não há configuração no banco.

### CA-04 — Validação dos campos
- **Given** valores inválidos (ex.: porta não numérica, e-mail de remetente malformado)
- **When** tento salvar
- **Then** recebo mensagens de validação por campo e nada é gravado.

### CA-05 — Enviar e-mail de teste
- **Given** uma configuração salva
- **When** clico em **"Enviar teste"** e informo um destinatário
- **Then** o sistema dispara um e-mail de teste usando a configuração atual
- **And** vejo um retorno claro de **sucesso** ou de **falha** (com o motivo, quando disponível)
- **And** em dev, o e-mail de teste aparece no Mailpit.

### CA-06 — Senha SMTP preservada quando em branco
- **Given** que deixo o campo de senha SMTP em branco ao salvar
- **When** a gravação ocorre
- **Then** a senha previamente salva é **mantida** (não é sobrescrita por vazio).

### CA-07 — Autorização obrigatória
- **Given** que **não** tenho a permissão `settings:manage`
- **When** tento acessar a tela ou salvar
- **Then** recebo `403` e não consigo ver/alterar a configuração (ver **US-10**).

## Notas técnicas (orientação para implementação)
- Configuração persistida no Postgres (ex.: tabela `settings` chave→valor ou `email_settings` dedicada); leitura com precedência **banco → env (fallback)**.
- Senha SMTP guardada de forma protegida e tratada como **somente-escrita** na API (nunca retornada ao cliente).
- Reaproveitar a infra de e-mail existente (`server/lib/mail.ts` / Nodemailer) e os schemas Zod (manter `client` e `server` em sincronia).
- Endpoints sugeridos: `GET /api/admin/settings/email`, `PUT /api/admin/settings/email`, `POST /api/admin/settings/email/test`.
- Abas verticais como componente reutilizável, preparado para novas seções de configuração.

## Dependências
- **US-10** (autorização por permissão) para o guard `settings:manage`.
- Compartilha a infra de e-mail usada por **US-04** (esqueci senha) e **US-06** (convites).

## Definição de pronto
- [ ] Abas verticais com a aba E-mail ativa e espaço para futuras abas.
- [ ] Configuração carrega do banco (com fallback para env) e salva no banco sem redeploy.
- [ ] Senha SMTP somente-escrita e preservada quando em branco.
- [ ] Botão "Enviar teste" com retorno de sucesso/falha (validado no Mailpit em dev).
- [ ] Permissão `settings:manage` exigida.
