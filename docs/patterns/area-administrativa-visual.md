# Padrão Visual — Área Administrativa (Painel)

Guia para criar telas novas do painel (`/painel/*`) e das telas de autenticação **seguindo o mesmo padrão**. Toda página nova deve compor o **kit de UI** (`src/painel/ui/`) — não reinventar cartões/botões/badges com classes soltas.

## Tokens

- **Paleta (Tailwind):** `iasd-dark` `#003366` (títulos, botão primário, sidebar), `iasd-accent` `#0055AA` (hover/links/foco), `iasd-light` `#F5F5F5` (fundo da área de conteúdo, chips).
- **Feedback (utilitários nativos):** sucesso = `green-*`, erro/perigo = `red-*`, alerta/bloqueio = `amber-*`.
- **Superfície:** branco. **Borda:** `gray-200`/`gray-300`. **Texto muted:** `gray-500`.
- **Raio:** `rounded-xl` (cartões/tabelas), `rounded-lg` (botões/inputs/badges grandes), `rounded-full` (chips/badges/avatar).
- **Elevação:** `shadow-sm` em cartões e tabelas. Sem sombras pesadas.
- **Foco:** `focus:ring-2 focus:ring-iasd-accent/40 focus:border-iasd-accent` (já embutido no `Input`).
- **Tipografia:** títulos com `font-heading` (Montserrat); corpo Inter (default).

## Anatomia de uma página do painel

```tsx
import { PageHeader, Card, Button } from '@/painel/ui'

export default function MinhaTela() {
  return (
    <div className="space-y-6">
      <PageHeader title="Título" subtitle="opcional" actions={<Button to="/painel/...">Ação</Button>} />
      {/* conteúdo em Card(s); largura total — sem max-w estreito */}
      <Card title="Seção">…</Card>
    </div>
  )
}
```

- Páginas ocupam a **largura total** da área de conteúdo (o `<main>` já dá padding). **Não** usar `max-w-*` estreito; para agrupar, use grids (`grid gap-6 md:grid-cols-2/3`).
- Raiz da página: `div.space-y-6`.
- Sempre começar com `<PageHeader>`; agrupar conteúdo em `<Card>`.

## Catálogo de componentes (`@/painel/ui`)

| Componente | Quando usar |
|------------|-------------|
| `PageHeader` | Cabeçalho da página: título + subtítulo + ações à direita. |
| `Card` | Agrupar conteúdo numa superfície branca. `title`/`actions` opcionais. |
| `Button` | Ações. Variantes `primary` \| `secondary` \| `danger` \| `ghost`; `size` `sm`\|`md`; `icon`; `full`. Passe `to` para virar `<Link>`. |
| `Badge` / `StatusBadge` | Etiqueta colorida; `StatusBadge` para status de conta (ativo/desativado). |
| `Chip` | Etiqueta pequena (papéis); `onRemove` para chip removível. |
| `Alert` | Mensagem de sucesso/erro (`message={msg}` ou `kind`+children). |
| `Field` + `Input`/`Select`/`Textarea` | Formulários. `Input` faz `forwardRef` (compatível com React Hook Form `{...register()}`). |
| `Table` + `THead` + `EmptyRow` + `th`/`td` | Listagens. Use `th`/`td` nas células e `EmptyRow` para vazio. |
| `Avatar` | Círculo com iniciais (`size` `md`\|`lg`). |
| `EmptyState` | Tela/área vazia (listas sem itens, "Em breve"). |
| `Spinner` | Indicador de carregamento circular. `className` para ajustar tamanho (ex.: `w-8 h-8`). |
| `Modal` | Overlay centralizado (renderiza via portal no `body`). Prop `size` `md`\|`lg`\|`xl` (default `md`) para largura do diálogo. |
| `Pager` | Paginação (Anterior/Próxima) para listagens paginadas. |

## Padrões de tela

- **Listagem:** `PageHeader` (com `Button` de ação) + `Table` (`THead` + linhas com `td`; `EmptyRow` no vazio) + `Pager` quando paginado. Ações por linha = **ícones com `title`** (tooltip), não texto.
- **Detalhe:** cabeçalho em `Card` com `Avatar` + `StatusBadge` + `Chip`s; conteúdo em grid de `Card`s (dados / relações / ações). Ações destrutivas com `Button variant="danger"`.
- **Formulário:** dentro de `Card`; `Field` + `Input/Select/Textarea`; submit com `Button` primary; feedback com `Alert`.
- **Autenticação:** cartão centralizado (`AuthCard`) sobre `bg-iasd-light`, com logo + título + `Field`s + `Button` primary `full`.
- **Carregamento:** enquanto uma listagem/recurso carrega, mostrar `<Spinner>` centralizado no lugar do conteúdo (evita o flash de `EmptyState`); para mídia/imagem, sobrepor o `Spinner` até o `onLoad`. Ex.: galeria de mídia em `src/painel/pages/Midia.tsx`.

## Regras

- **Não** crie cartões/botões/badges com classes Tailwind soltas — componha o kit. Se faltar um primitivo, **adicione ao kit** (e a este doc), não improvise na página.
- Cores de marca só via tokens `iasd-*`; feedback só via `green/red/amber`.
- Sem dependências externas de UI (shadcn/Radix/etc.) e sem tema escuro neste momento.
