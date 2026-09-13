# Build from the repository root: docker build -f apps/api/Dockerfile .
FROM node:22-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
# Explicit generation below avoids install-time schema discovery.
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true
RUN pnpm --filter api... install --frozen-lockfile
COPY apps/api/prisma/schema.prisma ./apps/api/prisma/schema.prisma
RUN pnpm --dir apps/api prisma:generate
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/nest-cli.json ./apps/api/
COPY apps/api/src ./apps/api/src
RUN pnpm --dir apps/api build
# Legacy deploy supports this workspace without changing its injection policy.
RUN pnpm --filter api deploy --legacy --prod /runtime
# Generate into the isolated production dependency tree, using the build CLI.
RUN pnpm --dir apps/api exec prisma generate --schema /runtime/prisma/schema.prisma

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /runtime/package.json ./package.json
COPY --from=build --chown=node:node /runtime/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/apps/api/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
