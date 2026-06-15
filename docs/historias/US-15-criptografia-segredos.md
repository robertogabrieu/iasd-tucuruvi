# US-15 — Criptografia de segredos de configuração

**Épico:** Segurança (transversal) · **Prioridade:** Must · **Estimativa:** 5 pts

> ✅ **Entregue** em `7ca3764`, `c2143d3`, `9f50003` — branch `feat/area-administrativa`. Ver [spec](../superpowers/specs/2026-06-15-painel-config-crypto-design.md) e [plano](../superpowers/plans/2026-06-15-painel-config-crypto.md).

## História

> **Como** responsável pela segurança do sistema,
> **eu quero** que segredos de configuração reversíveis sejam armazenados cifrados no banco,
> **para que** um vazamento do banco (dump, backup, réplica ou acesso indevido à tabela) não exponha credenciais utilizáveis.

## Contexto
Diferente das senhas de usuário — que são **hasheadas** com argon2id (via única, ver **US-01**) —, alguns segredos precisam ser **recuperados em texto claro** para serem usados (ex.: a senha SMTP da **US-14**). Para esses casos, a proteção correta é **criptografia reversível**, não hash. Esta história estabelece um mecanismo **único e reutilizável** de cifragem para todo segredo de configuração reversível, presente e futuro.

## Critérios de aceitação

### CA-01 — Cifragem em repouso (AES-256-GCM)
- **Given** um segredo de configuração reversível (ex.: senha SMTP)
- **When** ele é gravado no banco
- **Then** é armazenado **cifrado com AES-256-GCM**, guardando `ciphertext`, `iv`/`nonce` e `auth_tag`
- **And** o valor em texto claro **nunca** é persistido.

### CA-02 — Chave fora do banco
- **Given** o mecanismo de cifragem
- **When** o sistema cifra ou decifra
- **Then** a chave vem de variável de ambiente (`CONFIG_ENCRYPTION_KEY`, 32 bytes)
- **And** a chave **não** é armazenada no banco nem versionada no repositório
- **And** o `deploy.sh` gera essa chave automaticamente (`openssl rand`) e o `.env.example` a documenta.

### CA-03 — Integridade verificada
- **Given** um registro cifrado cujo conteúdo foi adulterado no banco
- **When** o sistema tenta decifrá-lo
- **Then** a verificação do `auth_tag` (GCM) falha e a operação é rejeitada com erro claro
- **And** nenhum dado corrompido é usado silenciosamente.

### CA-04 — Segredo nunca exposto
- **Given** qualquer segredo cifrado
- **When** ele trafega pela API, logs ou mensagens de erro
- **Then** o valor decifrado **nunca** é retornado ao cliente nem registrado em log
- **And** na UI o campo é tratado como **somente-escrita** (alinhado à **US-14**).

### CA-05 — Mecanismo reutilizável
- **Given** uma nova feature que precise guardar um segredo reversível
- **When** ela usa o serviço de cifragem
- **Then** basta chamar `encrypt(valor)` / `decrypt(registro)` — sem reimplementar criptografia por feature
- **And** o componente vive em `core/security/` (ex.: `crypto.service.ts`), seguindo a arquitetura em camadas do `CLAUDE.md`.

### CA-06 — Rotação de chave
- **Given** que a `CONFIG_ENCRYPTION_KEY` precisa ser trocada
- **When** a rotação é executada
- **Then** existe um procedimento (rotina/script) que re-cifra os segredos existentes com a nova chave
- **And** o processo é documentado.

## Notas técnicas (orientação para implementação)
- AES-256-GCM nativo do Node (`crypto`), sem dependência nova.
- Não usar `pgcrypto`/`pgp_sym_encrypt` no banco: evita a chave trafegar em queries/`pg_stat_statements`/logs.
- Apenas o campo **sensível** é cifrado; metadados não sensíveis (host, porta, remetente) ficam em texto plano.
- Persistir um indicador de versão de chave junto ao registro facilita a rotação (CA-06).
- Reforço de defesa em profundidade (fora do escopo de código desta história, mas registrar): serviço `db` sem porta exposta, usuário de banco com menor privilégio, TLS quando o banco for remoto, backups cifrados.

## Dependências
- **US-14** (configurações de e-mail) é o primeiro consumidor do mecanismo.
- Complementa **US-01** (hash de senha de usuário): esta história trata de segredos **reversíveis**; senhas de usuário continuam em argon2id.

## Definição de pronto
- [ ] Serviço de cifragem AES-256-GCM em `core/security/`, reutilizável.
- [ ] Chave via `CONFIG_ENCRYPTION_KEY` (gerada no `deploy.sh`, documentada no `.env.example`).
- [ ] Integridade (auth tag) validada na decifragem.
- [ ] Segredo nunca retornado/logado; campo somente-escrita na UI.
- [ ] Procedimento de rotação de chave documentado.
