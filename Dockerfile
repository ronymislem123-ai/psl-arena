# PSL ARENA — production image (Node 22, SQLite with a persistent volume at /data)
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts ./scripts
COPY public/models ./public/models
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/public/mediapipe ./public/mediapipe
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 PSL_ARENA_DATA_DIR=/data
RUN useradd --create-home --uid 1001 arena && mkdir -p /data && chown arena:arena /data
COPY --from=build --chown=arena:arena /app/package.json /app/package-lock.json ./
COPY --from=build --chown=arena:arena /app/node_modules ./node_modules
COPY --from=build --chown=arena:arena /app/.next ./.next
COPY --from=build --chown=arena:arena /app/public ./public
COPY --from=build --chown=arena:arena /app/scripts ./scripts
COPY --from=build --chown=arena:arena /app/next.config.ts /app/tsconfig.json ./
USER arena
VOLUME ["/data"]
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
