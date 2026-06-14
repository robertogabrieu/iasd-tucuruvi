# Histórias de Usuário — Área Administrativa (Auth + RBAC)

Backlog da expansão de **área de usuário** do site IASD Tucuruvi: autenticação, recuperação de senha e segurança, com backend Express + PostgreSQL e autorização RBAC.

As histórias seguem o padrão **Mountain Goat Software** ([referência](https://www.mountaingoatsoftware.com/agile/user-stories)):

> **Como** `<persona>`, **eu quero** `<objetivo>`, **para que** `<benefício>`.

Cada arquivo contém: a narrativa da história, critérios de aceitação no formato **Given / When / Then**, notas técnicas e a definição de pronto (DoD).

## Personas

- **Administrador** — pessoa da equipe/secretaria da igreja com acesso ao painel para gerenciar o conteúdo do site. Hoje todos os usuários têm a role `admin`.
- **Sistema** — rotinas automáticas (seed, expiração de tokens) descritas como ator quando não há pessoa envolvida.

## Backlog

| Épico | # | História |
|-------|---|----------|
| **Autenticação** | [US-01](US-01-login.md) | Login com e-mail e senha |
| | [US-02](US-02-logout.md) | Logout |
| | [US-03](US-03-sessao-persistente.md) | Sessão persistente com refresh token rotativo |
| | [US-04](US-04-esqueci-senha.md) | Esqueci minha senha |
| | [US-05](US-05-redefinir-senha.md) | Redefinir senha via token de uso único |
| | [US-08](US-08-protecao-forca-bruta.md) | Proteção contra força bruta |
| **Autorização (RBAC)** | [US-10](US-10-autorizacao-por-permissao.md) | Autorizar ações por permissão |
| | [US-11](US-11-gerenciar-papeis.md) | Gerenciar papéis de um usuário |
| **Gestão de usuários** | [US-06](US-06-convidar-usuario.md) | Convidar novo usuário |
| | [US-07](US-07-aceitar-convite.md) | Aceitar convite e definir senha |
| **Bootstrap** | [US-09](US-09-seed-inicial.md) | Seed do usuário e role iniciais |
| **Interface do Painel** | [US-13](US-13-menu-lateral.md) | Menu lateral colapsável do painel |
| | [US-14](US-14-configuracoes-email.md) | Tela de configurações (e-mail do sistema) |
| **Segurança (transversal)** | [US-15](US-15-criptografia-segredos.md) | Criptografia de segredos de configuração |
| **Boletim Informativo** | [US-16](US-16-editor-boletim.md) | Editor de boletim (blocos) |
| | [US-17](US-17-biblioteca-midia.md) | Biblioteca de mídia (upload e reuso de imagens) |
| | [US-18](US-18-publicar-gerar-link.md) | Publicar boletim e gerar link |
| | [US-19](US-19-pagina-publica-preview.md) | Página pública do boletim + preview no WhatsApp |
| | [US-20](US-20-gerenciar-boletins.md) | Listar e gerenciar boletins |
| | [US-21](US-21-templates-boletim.md) | Templates de boletim |
| **Redirecionamento de Links** | [US-22](US-22-redirecionamento-links.md) | Encurtador/redirecionador de links próprio |

## Convenções

- **Prioridade:** `MoSCoW` (Must / Should / Could).
- **Estimativa:** story points (escala de Fibonacci), referencial — a serem revisados no planning.
- Detalhes de arquitetura/segurança no `CLAUDE.md`, seção *Backend — Área Administrativa, Autenticação e RBAC*.
