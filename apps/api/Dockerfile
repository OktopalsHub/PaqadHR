# Paqad API — monorepo build (context: repository root)
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
RUN apt-get update && apt-get install curl -y && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/contracts/package.json ./packages/contracts/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api ./apps/api
COPY packages/contracts ./packages/contracts
RUN pnpm --filter @paqadhr/contracts build
WORKDIR /app/apps/api
RUN pnpm build

FROM base AS runner
WORKDIR /app/apps/api
ENV NODE_ENV=production
ENV PORT=9001
EXPOSE 9001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:9001/health || exit 1

COPY --from=dependencies /app/node_modules /app/node_modules
COPY --from=dependencies /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/packages/contracts/dist /app/packages/contracts/dist
COPY --from=builder /app/packages/contracts/package.json /app/packages/contracts/package.json
# Runtime readFileSync resolves to /app/constants from dist/common/constants/
COPY constants /app/constants
COPY apps/api/package.json ./

RUN npm install -g pm2@latest
USER node
CMD ["sh", "-c", "npx typeorm migration:run -d dist/common/database/config/data-source.js && pm2 start -s dist/main.js --name paqad-api -i max --no-daemon"]
