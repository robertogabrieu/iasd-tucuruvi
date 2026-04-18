# Página Dedicada do Clube de Desbravadores Antares — Design

**Data:** 2026-04-17
**Status:** Aprovado pelo usuário, pendente revisão automática

## Contexto

O site institucional da IASD Tucuruvi (`iasd-tucuruvi`) hoje é uma SPA React + Vite + Express com páginas dedicadas em `/sermoes` e `/galeria`, e uma home com seções em scroll contínuo. O Clube de Desbravadores Antares completou 65 anos em 2026 e não tem presença no site. Pais e adolescentes da comunidade precisam de uma página que:

1. Apresente o clube de forma institucional.
2. Mostre quem pode participar (faixa etária, horários).
3. Convide novos membros via WhatsApp (canal que a diretoria já usa).
4. Mostre fotos reais das atividades (via Flickr, que já é a fonte oficial do site).

## Escopo

**Inclui:**
- Nova rota `/desbravadores` como página dedicada (mesmo padrão de `/sermoes` e `/galeria`).
- Link no header principal (entre "Sobre" e "Ao Vivo").
- Consumo de álbuns específicos do Flickr via proxy Express (reuso de `fetchFlickrFeed`).
- Logo oficial do clube copiado para `public/img/`.
- CTA principal levando ao WhatsApp do diretor.

**Não inclui:**
- Página dos Aventureiros (Antares Kids) — será tratada em issue separada.
- Sistema de inscrição online / formulário — dúvidas, valores e inscrição ficam no WhatsApp.
- Texto institucional definitivo — vai entrar como lorem ipsum por enquanto; o usuário atualiza depois.
- Exibição de valores mensais na página — conversado somente no WhatsApp.

## Arquitetura

### Frontend — `src/pages/Desbravadores.tsx`

Nova página no padrão das existentes (`Galeria.tsx`, `Sermoes.tsx`). Importada em `src/App.tsx` e registrada como `<Route path="/desbravadores" element={<Desbravadores />} />`.

Estrutura em seções (scroll contínuo dentro da página, `max-w-5xl`, títulos centralizados com `SectionTitle`, animações `fade-up` via AOS, divisores diagonais via `DiagonalDivider` quando fizer sentido):

1. **Hero do clube**
   - Fundo azul escuro (`bg-iasd-dark`) com mesma textura/overlay do Hero da home.
   - Logo do Antares centralizado (`public/img/antares-logo.webp`), ~200px largura.
   - Título `h1`: "Clube de Desbravadores Antares" (font-heading, cor branca).
   - Subtítulo: "65 anos formando líderes para Cristo" (cor `text-blue-300` para paridade visual com o versículo do Hero principal).
   - CTA primário: botão "Fale conosco no WhatsApp" abrindo `https://wa.me/5511965673971` em nova aba.

2. **Sobre o clube**
   - Fundo `bg-iasd-light`.
   - Parágrafo com texto institucional (lorem ipsum inicialmente — 2–3 parágrafos).
   - Badge ou destaque "Fundado em 1961" (comentário no código explicando que o cálculo é 2026−65).

3. **Quem pode participar**
   - Fundo branco.
   - Grid de 3 cards (1 coluna no mobile, 3 no desktop):
     - Card 1: "Crianças e adolescentes" — 10 a 15 anos.
     - Card 2: "Liderança" — aceita adolescentes/jovens acima dessa faixa, desde que batizados na IASD.
     - Card 3: "Encontros" — "Domingos, 9h".
   - Abaixo do grid, uma nota discreta (texto menor, cinza): "Algumas datas podem ter alterações por conta de feriados, treinamentos ou eventos especiais. Confirme a próxima reunião pelo WhatsApp."

4. **Galeria do clube**
   - Fundo `bg-iasd-light`.
   - `SectionTitle` "Galeria".
   - Grid de fotos usando `PhotoCard` (2 cols mobile, 3 md, 4 lg — mesma grade de `Galeria.tsx`).
   - Até 12 fotos puxadas do endpoint novo `/api/flickr/antares`.
   - Estados: loading (texto "Carregando fotos..."), sucesso (grid), erro/vazio (mensagem fallback).
   - Link final: "Ver mais no Flickr" → página do álbum principal (`72177720322507560`).

5. **Como participar (CTA final)**
   - Fundo `bg-iasd-dark` (inverte contraste pra destacar).
   - Card central com glassmorphism (`bg-white/10 backdrop-blur-lg border border-white/20`) semelhante ao card do countdown no Hero da home.
   - Linha 1: "Diretor: **Eric Domingues**".
   - Linha 2: texto "Tire dúvidas, saiba valores e inscreva seu filho(a) pelo WhatsApp."
   - Botão grande: "(11) 96567-3971" com ícone do WhatsApp → `https://wa.me/5511965673971`.

### Backend — novo endpoint no Express

Adicionar em `server/index.ts`:

```ts
const FLICKR_ANTARES_ALBUMS = ['72177720322507560', '72177720318561272']

app.get('/api/flickr/antares', async (_req, res) => {
  const count = Number(_req.query.count) || 12
  const perAlbum = Math.ceil(count / FLICKR_ANTARES_ALBUMS.length)
  const results = await Promise.all(
    FLICKR_ANTARES_ALBUMS.map((id) =>
      fetchFlickrFeed(
        `https://api.flickr.com/services/feeds/photoset.gne?set=${id}&nsid=${FLICKR_USER_ID}&format=json&nojsoncallback=1`,
        perAlbum
      )
    )
  )
  const merged = results.flat().slice(0, count)
  res.json(merged)
})
```

Observações:
- Reusa `fetchFlickrFeed` e seu cache singleton de 1h por URL.
- Não adiciona dependência nova.
- `FLICKR_USER_ID` já existe no escopo do arquivo.
- Álbuns escolhidos: "Aniversário de 64 anos do Clube Antares" (189 fotos) e "Calebe FIT - Antares APL" (atividade específica do clube). Se no futuro houver mais álbuns, basta estender o array.

### Componentes reutilizados

- `Header`, `Footer`, `SectionTitle`, `PhotoCard`, `DiagonalDivider` — tudo já existe.
- Nenhum componente novo é necessário para o MVP. Se o "card de participante" (seção 3) ficar muito repetido em outras páginas no futuro, viramos `InfoCard`. Por ora, inline com Tailwind basta.

### Assets

- Copiar `/home/robertogabrieu/desbravadores-finance/android/app/src/main/res/drawable/club_logo.webp` para `public/img/antares-logo.webp`.
- Nenhuma conversão de formato: `webp` é aceito em todos os navegadores modernos.

### Navegação

Em `src/components/Header.tsx`, adicionar ao array `navLinks`:

```ts
{ href: '/desbravadores', label: 'Desbravadores' },
```

Posição: entre `{ href: '/#sobre' }` e `{ href: '/#ao-vivo' }`. O Header já diferencia rotas (`/`) de âncoras (`/#`) via `link.href.startsWith('/#')`, então o novo item flui naturalmente.

## Fluxo de dados

```
User abre /desbravadores
  → Router renderiza <Desbravadores />
  → useEffect dispara fetch('/api/flickr/antares?count=12')
    → Vite dev proxy (ou Express em prod) encaminha pra /api/flickr/antares
    → Handler consulta 2 álbuns Flickr em paralelo (cache de 1h)
    → Retorna array unificado de FlickrPhoto[]
  → Estado local recebe fotos, renderiza grid
Link do CTA → abre WhatsApp em nova aba (sem JS)
```

## Tratamento de erros

- **Flickr offline / erro:** `fetchFlickrFeed` já retorna `[]` em caso de falha. Página mostra "Não foi possível carregar as fotos." (mesmo texto de `Galeria.tsx` — consistência).
- **Logo 404:** improvável após cópia; se ocorrer, fallback do browser (imagem quebrada). Não vale complexidade extra.
- **WhatsApp sem app instalado:** `wa.me` redireciona pro web.whatsapp.com automaticamente. Nenhuma lógica adicional no frontend.

## Testes

Projeto não tem suíte automatizada. Validação manual no browser:

1. `npm run dev` + `npm run dev:server` (ou `docker compose up`).
2. Acessar `http://localhost:5173/desbravadores` — verificar que a página carrega sem 404.
3. Conferir navegação via header (item "Desbravadores" visível e funcional, incluindo mobile menu).
4. Confirmar que as fotos do Flickr aparecem (testar com internet ativa — cache pode mascarar falha do fetch).
5. Testar botão WhatsApp (abrir link, conferir número correto 5511965673971).
6. Verificar responsividade: mobile (grid 2 cols), tablet (3 cols), desktop (4 cols).
7. Conferir que home e outras rotas continuam intactas.

## Decisões de design e trade-offs

- **Rota dedicada vs. seção na home:** escolhida rota dedicada para seguir o padrão já estabelecido (`/sermoes`, `/galeria`) e porque Desbravadores merece profundidade de conteúdo (galeria + info do clube + CTA dedicado).
- **Endpoint agregador `/api/flickr/antares` vs. chamar `/api/flickr/album?id=X` 2x no client:** optado pelo endpoint agregador para manter a lógica de mescla no servidor (mais fácil ajustar a lista de álbuns no futuro sem republicar o frontend) e pra aproveitar o cache do server uma única resposta.
- **Lorem ipsum para o texto institucional:** o usuário ainda não tem o copy final; colocar texto definitivo bloquearia a entrega. Fica como placeholder explícito.
- **Valores ocultos:** direcionar tudo pro WhatsApp evita desatualização e respeita o processo atual da diretoria.
- **Não mostrar horários dinâmicos de exceção:** não vale construir um calendário de exceções por enquanto. A nota de rodapé direciona ao WhatsApp, que é a fonte da verdade operacional.

## Follow-ups (pós-entrega)

- Abrir issue no GitHub: "feat: página dedicada do Clube de Aventureiros (Antares Kids)".
- Substituir lorem ipsum por texto institucional real (usuário fornecerá).
- Considerar adicionar mais álbuns ao endpoint quando forem criados no Flickr.
- Avaliar se o Header vai ficar cheio demais com mais uma entrada futura ("Aventureiros"). Pode exigir submenu "Clubes" agrupando os dois.
