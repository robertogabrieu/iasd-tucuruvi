# Spec — Detecção de "Ao Vivo" agendada + correção do player

- **Data:** 2026-06-17
- **Branch:** `feat/live-detection`
- **Relacionado:** seção "Ao Vivo / Últimos Vídeos" da home (`src/components/AoVivo.tsx`), YouTube Data API (já em uso em `server/lib/youtube.ts`)

---

## 1. Objetivo e contexto

A seção "Ao Vivo / Últimos Vídeos" da home tem **dois bugs**:
1. O player de "Últimos Vídeos" incorpora a **playlist de uploads do canal** (`embed/videoseries?list=UU…`), que o YouTube **bloqueia para embed** → player não carrega.
2. A detecção de "ao vivo" faz `fetch` no `youtube.com/oembed` **do navegador**, sem CORS → sempre falha → `isLive` sempre `false`.

Objetivo: **detectar live de verdade** (no servidor, via YouTube Data API) e **consertar o player**, mantendo o uso **sempre dentro da cota grátis** (10.000 unidades/dia) por meio de uma checagem **agendada** só nos horários de culto.

## 2. Escopo

### Dentro do escopo
- Endpoint `GET /api/youtube/live` → `{ isLive: boolean, videoId: string | null }`, com checagem agendada e cacheada no servidor.
- `AoVivo` passa a ler esse endpoint (em vez do oEmbed CORS) e a incorporar: a **live** (quando ao vivo) ou o **último vídeo** (via `/api/youtube/cultos?count=1`) — corrigindo o embed quebrado.

### Fora do escopo
- Checagem de live na **quarta** (CLAUDE.md lista culto Qua 20h, mas o usuário pediu detecção só **Sáb/Dom**). Fácil de estender depois.
- Mudança visual além de trocar o conteúdo do player.

## 3. Decisões de design (confirmadas)

1. **Opção B — detecção real via Data API** (`search.list`, `eventType=live`), no **servidor** (cache compartilhado), não no cliente.
2. **Janelas de culto (fuso `America/Sao_Paulo`)** em que se checa a cada **10 min**:
   - **Sábado:** 09:00–10:00 e 16:00–18:00.
   - **Domingo:** 18:30–19:30.
   - **Sáb/Dom fora das janelas:** checa a cada **60 min**.
   - **Seg–Sex:** **não checa** (retorna `isLive:false` sem chamar a API).
3. **Sem live → player mostra o último vídeo** da **playlist curada de cultos** (`PLwnLJcWxPcgSDNzfxjlhRC-3QC-3h2Atb`, via `/api/youtube/cultos?count=1` que retorna `[{videoId,title}]`), incorporado por **ID** (`embed/<videoId>`). "Último" = o mais recente **dessa playlist** (não o upload mais novo do canal) — coerente com a seção.
4. **Reusa `YOUTUBE_API_KEY`**; sem env nova, sem dependência nova.

## 4. Cota (precisa ficar sempre no grátis)

`search.list` = **100 unidades/chamada**; cota grátis = **10.000/dia**. Com a checagem **server-side cacheada** (independe de nº de visitantes):
- **Sábado:** janelas 10min (9–10h: 6 + 16–18h: 12 = 18) + resto do dia 60min (~21) ≈ **39 chamadas → ~3.900 unidades**.
- **Domingo:** ~60min o dia quase todo + janela 18:30–19:30 ≈ **~27 chamadas → ~2.700 unidades**.
- **Seg–Sex:** **0**.
- Pior dia (sábado) ≈ **3.900 / 10.000 (~39%)** → folgado, mesmo somando os ~24 un./dia da listagem de sermões. (Se quiser ainda menos, dá pra não checar de madrugada — fora de escopo agora.)

## 5. Backend

### 5.1 Agenda + checagem (novo `server/lib/youtube-live.ts`)
Função pura de agenda + função de status com cache (mesmo estilo do cache de `fetchYouTubePlaylist`).

**`liveCheckIntervalMs(now: Date): number | null`** — TTL pela hora local de SP:
- Derivar **weekday + HH:MM em `America/Sao_Paulo`** via `Intl.DateTimeFormat('en-US', { timeZone:'America/Sao_Paulo', weekday:'short', hour:'2-digit', minute:'2-digit', hour12:false }).formatToParts(now)` — usar `formatToParts` (não montar/splitar string), mapear `weekday` (`Sat`/`Sun`) por token estável, e **normalizar `hour === 24 → 0`**; `hour`/`minute` como inteiros. **Nunca** usar `new Date()` do servidor direto (VPS em UTC).
- Seg–Sex → `null` (não checa).
- Sáb/Dom **dentro de janela** → `10*60_000`; **fora** → `60*60_000`. Janelas: Sáb `09:00–10:00` e `16:00–18:00`; Dom `18:30–19:30` (limites: início inclusivo, fim exclusivo).

**`getLiveStatus(): Promise<{isLive,videoId}>`** — cache em memória `let cache: { value: {isLive:boolean; videoId:string|null}; fetchedAt:number } | null` + `let inflight: Promise<...> | null`:
1. `now = new Date()`; `ttl = liveCheckIntervalMs(now)`.
2. **`ttl === null` (dia útil)** → retorna `{ isLive:false, videoId:null }` **sem** API e **sem** mexer no cache.
3. **Validade pelo intervalo ATUAL** (corrige a janela mascarada): se `cache && (now - cache.fetchedAt) < ttl` → retorna `cache.value`. (Assim, ao **entrar numa janela**, um cache de 60min vira "vencido" porque passa a ser medido contra os 10min.)
4. **Single-flight:** se já há `inflight`, **aguarda e reusa** (não dispara nova chamada). Senão `inflight = searchLiveVideo()`; ao resolver, grava `cache = { value, fetchedAt: now }` e limpa `inflight`.
5. **Erro/sem key:** captura, **loga**, e **cacheia `{isLive:false,videoId:null}` com `fetchedAt:now`** (backoff = o próprio intervalo). Isso evita re-disparar `search.list` a cada poll de 60s durante uma janela (sem isso, um erro numa janela de 2h = ~120 polls × 100 = ~12k un. → estouro). Nunca derruba a home.

**`searchLiveVideo()`** → `GET https://www.googleapis.com/youtube/v3/search?part=id&channelId=<CHANNEL_ID>&eventType=live&type=video&maxResults=1&key=<key>` (**`type=video` é obrigatório** com `eventType`; `part=id` é suficiente, 100 un.). Se houver item → `{ isLive:true, videoId: items[0].id.videoId }`, senão `{ isLive:false, videoId:null }`. `CHANNEL_ID = 'UCvtcRQ8TcPLZn5dP42bODFg'`.

### 5.2 Rota (`server/index.ts`, pública, como as outras `/api/youtube/*`)
- `GET /api/youtube/live` → `res.json(await getLiveStatus())`. Sem auth (rota pública, como `/api/youtube/cultos`).

## 6. Frontend (`src/components/AoVivo.tsx`)
- Remover o `fetch` ao `youtube.com/oembed` (CORS). Passar a buscar **`/api/youtube/live`** (e o último vídeo de `/api/youtube/cultos?count=1`).
- Estado: `isLive`, `liveVideoId`, `latestVideoId`.
- **Polling**: a cada **60 s** chamar `/api/youtube/live` (barato; o servidor é que controla o custo da Data API). Buscar o último vídeo uma vez (e revalidar junto, opcional).
- **Embed**:
  - `isLive && liveVideoId` → `https://www.youtube.com/embed/${liveVideoId}?autoplay=1` + bolinha vermelha + título "Ao Vivo".
  - senão, se `latestVideoId` → `https://www.youtube.com/embed/${latestVideoId}` + título "Últimos Vídeos".
  - sem nada → mantém o link do canal (sem player quebrado).
- Mantém layout/estilo atuais (só troca a fonte do `isLive` e o `src` do iframe).

## 7. Segurança / robustez
- Rota pública sem dados sensíveis. A key fica **só no servidor** (a chamada à Data API é server-side).
- Falha de rede/Data API → `isLive:false` + player cai pro último vídeo; nunca quebra a home.
- Timezone fixo `America/Sao_Paulo` (independe do fuso do VPS).

## 8. Verificação manual (sem suíte de testes — convenção do projeto)
- `GET /api/youtube/live` retorna `{isLive:false,videoId:null}` num dia útil **sem** bater na Data API (conferir nos logs que não há chamada).
- Forçar (em teste) um sábado/horário de culto e confirmar 1 chamada `search.list` (e cache de 10 min). *(Pode-se testar a função de agenda com horários simulados.)*
- Player mostra o **último vídeo** quando não há live (corrige o embed quebrado); quando houver live real, mostra a transmissão.
- Cota: confirmar no Google Cloud (Métricas) que o consumo diário fica em centenas/poucos milhares de unidades.

## 9. Definição de pronto
- [ ] `GET /api/youtube/live` com checagem agendada (SP), `search.list` só em Sáb/Dom, cache 10/60 min, 0 chamadas em dias úteis.
- [ ] `AoVivo` usa o endpoint (sem oEmbed CORS); player incorpora live por ID ou último vídeo por ID (sem embed de playlist de uploads).
- [ ] Falhas degradam pro último vídeo; cota dentro do grátis; sem env/dep nova.
