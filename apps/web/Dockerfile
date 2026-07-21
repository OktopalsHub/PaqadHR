# Paqad Web — monorepo build (context: repository root)
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/web/node_modules ./apps/web/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Shared reserved-slug list (imported via ../../../../constants/...)
COPY constants ./constants
COPY apps/web ./apps/web
WORKDIR /app/apps/web
RUN pnpm build

FROM base AS runner
WORKDIR /app/apps/web
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

COPY --from=dependencies /app/node_modules /app/node_modules
COPY --from=dependencies /app/apps/web/node_modules ./node_modules
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY apps/web/package.json ./

USER node
CMD ["pnpm", "start"]
