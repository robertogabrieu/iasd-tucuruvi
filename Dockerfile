FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache --virtual .build-deps python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
RUN apk del .build-deps

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# O sharp desenha o texto das imagens do evento pelas fontes INSTALADAS no sistema, não pelas
# da CDN do site. Sem fontconfig e sem estes arquivos ele cai numa fonte substituta e a capa
# sai errada sem erro nenhum (spec §6.4). Montserrat e Inter são OFL, redistribuíveis.
RUN apk add --no-cache fontconfig
COPY public/fonts/Montserrat.ttf public/fonts/Inter.ttf /usr/share/fonts/truetype/iasd/
RUN fc-cache -f

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3001
CMD ["node", "dist-server/index.js"]
