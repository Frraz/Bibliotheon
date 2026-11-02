# Bibliotheon — imagem de produção (Next.js standalone + SQLite).
# Build:  docker compose -f docker-compose.prod.yml build
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: o better-sqlite3 já traz o binário em prebuilds/ (sem compilador na imagem) e nenhum pacote
# de produção precisa de script de instalação. Também evita rodar scripts de terceiros no build.
RUN npm ci --ignore-scripts

FROM deps AS build
WORKDIR /app
COPY . .
# Valores fixados no build (canonical, sitemap, pixels): mudar um deles exige novo build.
ARG SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_META_PIXEL_ID=
ARG NEXT_PUBLIC_GA4_ID=
ARG NEXT_PUBLIC_CONTATO_EMAIL=
ENV SITE_URL=$SITE_URL \
    NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID \
    NEXT_PUBLIC_GA4_ID=$NEXT_PUBLIC_GA4_ID \
    NEXT_PUBLIC_CONTATO_EMAIL=$NEXT_PUBLIC_CONTATO_EMAIL \
    DATABASE_PATH=:memory: \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_PATH=/app/data/bibliotheon.db MEDIA_DIR=/app/data/media
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/drizzle ./drizzle
# Criar/recuperar a conta de administrador: docker exec -it bibliotheon_web node scripts/criar-owner.mjs <e-mail>
COPY --from=build --chown=node:node /app/scripts/criar-owner.mjs ./scripts/criar-owner.mjs
# Pasta de dados: o volume é montado aqui (dono uid 1000 = usuário "node").
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
