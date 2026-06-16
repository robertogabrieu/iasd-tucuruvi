# Padrão de página de departamento

Receita canônica para páginas dedicadas a clubes e departamentos da igreja (Desbravadores, Aventureiros, e futuros). A rota `/desbravadores` é a implementação de referência — sempre que surgir um novo departamento, seguir essa mesma receita.

## Por que existe esse padrão

- Cada departamento tem identidade visual própria (cores, logo, fotos) que não cabe no tema institucional azul/branco do site.
- A experiência entre departamentos precisa ser consistente: mesma estrutura de seções, mesmos componentes, mesmos pontos de contato (WhatsApp).
- O custo de manter "N páginas diferentes cada uma num estilo" cresce rápido. Padronizar a estrutura e isolar só as cores/assets por departamento resolve.

## Estrutura da página

Scroll contínuo dentro da rota, com estas seções nessa ordem:

1. **Hero** — fundo escuro neutro (`bg-<dept>-ink`) com foto do departamento a ~40% de opacidade e gradient sutil por cima. Logo do clube centralizado (grande, ~192px), `h1` com nome completo, subtítulo curto em dourado, CTA primário arredondado levando ao WhatsApp da liderança.
2. **Sobre o departamento** — fundo creme (`bg-<dept>-cream`). Texto institucional em 2 colunas no desktop, 1 no mobile. Badge discreto com marco histórico (ex.: "Fundado em 1961").
3. **Quem pode participar** — fundo areia (`bg-<dept>-sand`). Grid de 3 cards (público-alvo / liderança / encontros), cada um com ícone, título e descrição curta. Nota abaixo em texto menor direcionando dúvidas ao WhatsApp.
4. **Galeria** — fundo creme. Carrossel Embla com autoplay 5s, setas, indicadores, loop, pausa no hover. Abaixo, botão "Ver mais no Flickr".
5. **Fale conosco** — fundo escuro neutro com gradient. Card glassmorphism com borda dourada, título curto ("Fale conosco"), texto de apoio e botão grande do WhatsApp (verde oficial `#25D366`).

## Paleta de cor por departamento

Cada departamento ganha uma entrada em `tailwind.config.ts` com essas chaves:

```ts
<dept>: {
  red:   '#...',  // cor primária do clube (usada em botões, badges, títulos de seção)
  gold:  '#...',  // acento (subtítulos, bordas, "diretor"/labels)
  ink:   '#...',  // escuro neutro (fundos do hero, do header e do Fale conosco)
  cream: '#...',  // fundo claro principal
  sand:  '#...',  // fundo claro alternativo
}
```

Exemplo (Antares — Desbravadores):

```ts
antares: {
  red: '#ad220f',
  gold: '#faca13',
  ink: '#1f1d1b',
  cream: '#faf5ee',
  sand: '#f3ebd9',
}
```

A cor primária normalmente vem do logo do clube. `ink` é quase-preto com tom quente que harmoniza com a paleta.

## Header temático por rota

`src/components/Header.tsx` usa `useLocation()` e verifica a rota:

```ts
const { pathname } = useLocation()
const isAntares = pathname.startsWith('/desbravadores')
const headerBg = isAntares
  ? 'bg-antares-ink/80 backdrop-blur-lg border-b border-antares-gold/20'
  : 'bg-iasd-dark/70 backdrop-blur-lg border-b border-white/10'
```

Ao adicionar um novo departamento, acrescentar uma condição análoga.

## SectionTitle com variante

`src/components/SectionTitle.tsx` aceita `variant?: 'iasd' | 'antares'`. O default é `iasd` (azul). Cada departamento ganha uma entrada nova:

```ts
const darkTitle =
  variant === 'antares' ? 'text-antares-red' :
  variant === 'aventureiros' ? 'text-aventureiros-red' :
  'text-iasd-dark'
```

Na página do departamento, usar sempre `<SectionTitle ... variant="<dept>" />`.

## Galeria — carrossel Embla

Dependências: `embla-carousel-react` + `embla-carousel-autoplay` (ambas do mesmo autor, monorepo oficial).

```tsx
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'

const autoplay = useRef(
  Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true })
)
const [emblaRef, emblaApi] = useEmblaCarousel(
  { loop: true, align: 'start', skipSnaps: false },
  [autoplay.current]
)
```

- Responsive: cada slide com `basis-full sm:basis-1/2 lg:basis-1/3` dentro de um flex container.
- Setas prev/next com `emblaApi.scrollPrev()` / `scrollNext()`.
- Indicadores montados a partir de `scrollSnapList()`, com `selectedScrollSnap()` para destacar o atual.
- Autoplay pausa no hover e continua mesmo após interação do usuário (ajustável).

## Backend — endpoint agregador de fotos

Padrão em `server/index.ts`:

```ts
const FLICKR_<DEPT>_ALBUMS = ['<id1>', '<id2>', ...]

app.get('/api/flickr/<dept>', async (req, res) => {
  const count = Number(req.query.count) || 12
  const perAlbum = Math.ceil(count / FLICKR_<DEPT>_ALBUMS.length)
  const results = await Promise.all(
    FLICKR_<DEPT>_ALBUMS.map((id) =>
      fetchFlickrFeed(
        `https://api.flickr.com/services/feeds/photoset.gne?set=${id}&nsid=${FLICKR_USER_ID}&format=json&nojsoncallback=1`,
        perAlbum
      )
    )
  )
  // Round-robin intercala álbuns: 1º do A, 1º do B, 2º do A, 2º do B...
  const merged: FlickrPhoto[] = []
  const maxLen = Math.max(...results.map((r) => r.length))
  for (let i = 0; i < maxLen; i++) {
    for (const album of results) {
      if (album[i]) merged.push(album[i])
    }
  }
  res.json(merged.slice(0, count))
})
```

`fetchFlickrFeed` já tem cache de 1h por URL (Map indexado), então chamar múltiplas URLs em paralelo é seguro.

## Assets

- **Logo**: `public/img/<dept>-logo.png`. Precisa ter fundo transparente. Se o PNG original tiver fundo branco sólido, aplicar flood fill a partir dos cantos marcando pixels brancos (R,G,B ≥ 240) como alpha=0. Existe script de referência no histórico do repo (`/tmp/strip-bg.cjs` no commit de introdução do padrão).
- **Foto de hero**: `public/img/<dept>-hero.jpg`. Baixar do Flickr em tamanho `_b.jpg` (~1024px de largura) e hospedar no próprio repo — evita latência e dependência de uptime externo. Escolher foto que represente bem o departamento (pessoas do clube em ação, não evento genérico).

## WhatsApp

Cada departamento tem número próprio da liderança. Na página, definir no topo:

```tsx
const WHATSAPP_URL = 'https://wa.me/55<DDD><numero>'
const WHATSAPP_DISPLAY = '(DD) XXXXX-XXXX'
```

O botão final usa o verde oficial do WhatsApp (`bg-[#25D366]`) — essa é a única exceção ao tema do departamento.

## Checklist para nova página

- [ ] Nova rota em `src/App.tsx` (`/<dept>`) + import do componente da página
- [ ] Novo item em `navLinks` de `src/components/Header.tsx`
- [ ] Condicional de tema em `Header.tsx` para a nova rota
- [ ] Nova paleta em `tailwind.config.ts` (chave `<dept>` com red/gold/ink/cream/sand)
- [ ] Nova variante em `SectionTitle.tsx`
- [ ] Nova página em `src/pages/<Dept>.tsx` com as 5 seções (Hero, Sobre, Quem pode participar, Galeria, Fale conosco)
- [ ] Novo endpoint `/api/flickr/<dept>` em `server/index.ts` com os IDs de álbum relevantes
- [ ] Logo transparente em `public/img/<dept>-logo.png`
- [ ] Foto de hero em `public/img/<dept>-hero.jpg`
- [ ] Constantes `WHATSAPP_URL` e `WHATSAPP_DISPLAY` com dados da liderança do departamento
- [ ] Build passa (`npm run build`)
- [ ] Validação manual no browser: desktop 1280px, mobile 375px, navegação entre rotas, tema do header, carrossel (autoplay, setas, dots, swipe), WhatsApp abre corretamente
