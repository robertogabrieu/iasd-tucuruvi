# IASD Tucuruvi

Site institucional da Igreja Adventista do Sétimo Dia — Tucuruvi.

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Express 5 (API + serve SPA)
- **Roteamento:** React Router DOM v7
- **Formulário:** React Hook Form + Zod + Nodemailer
- **Animações:** AOS (Animate On Scroll)
- **Infra:** Docker Compose

## Pré-requisitos

- Node.js 20+
- Docker e Docker Compose (para deploy)

## Desenvolvimento

```bash
cp .env.example .env.local
npm install
```

Rode os dois servidores em terminais separados:

```bash
npm run dev          # Vite (frontend) — http://localhost:5173
npm run dev:server   # Express (API)   — http://localhost:3001
```

O Vite faz proxy automático de `/api` para o Express.

Para testar envio de email local, suba o Mailpit:

```bash
docker compose up mailpit
```

Painel do Mailpit: http://localhost:8025

## Build e produção

```bash
npm run build   # Gera dist/ (frontend) e dist-server/ (backend)
npm start       # Express serve tudo na porta 3001
```

## Deploy com Docker

```bash
chmod +x deploy.sh
./deploy.sh
```

O script verifica se Docker está instalado, builda as imagens e sobe os containers.

- App: http://localhost:3001
- Mailpit: http://localhost:8025

## Variáveis de ambiente

| Variável    | Descrição                  | Default                         |
|-------------|----------------------------|---------------------------------|
| `SMTP_HOST` | Host do servidor SMTP      | `localhost`                     |
| `SMTP_PORT` | Porta do servidor SMTP     | `1025`                          |
| `SMTP_FROM` | Email remetente            | `noreply@iasdtucuruvi.com.br`  |
| `SMTP_TO`   | Email destinatário         | `contato@iasdtucuruvi.com.br`  |
| `PORT`      | Porta do servidor Express  | `3001`                          |

## Estrutura

```
src/
  components/   # Componentes React (Header, Hero, Footer, etc.)
  pages/        # Páginas (Home, Sermoes, Galeria)
  schemas/      # Validação Zod (client-side)
server/
  index.ts      # Express: serve SPA + APIs
  lib/           # Lógica do backend (mail, rate-limit, flickr proxy)
public/
  img/           # Imagens estáticas
```

## APIs

| Método | Rota                | Descrição                          |
|--------|---------------------|------------------------------------|
| POST   | `/api/contato`      | Envia pedido de estudo bíblico     |
| GET    | `/api/flickr/album` | Proxy do álbum Flickr (cache 1h)   |
| GET    | `/api/flickr/photos`| Proxy das fotos públicas Flickr    |
