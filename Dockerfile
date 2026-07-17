# ---- builder: основной pnpm-проект (tsc + generateVersion.mjs, нужен git) ----
FROM node:20-bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ git \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# ---- dashboard: отдельный Vite-проект со своим lockfile (dashboard/), без
# собственного packageManager-пина — фиксируем ту же версию pnpm, что и корень ----
FROM node:20-bookworm-slim AS dashboard
WORKDIR /app/dashboard
RUN npm install -g pnpm@9.15.9
COPY dashboard/package.json dashboard/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY dashboard/ ./
RUN pnpm run build

# ---- runtime: только скомпилированный код + prod node_modules ----
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/miniapp/public ./miniapp/public
COPY --from=dashboard /app/dashboard/dist ./dashboard/dist

VOLUME ["/app/data"]
EXPOSE 3001
CMD ["node", "dist/index.js"]
