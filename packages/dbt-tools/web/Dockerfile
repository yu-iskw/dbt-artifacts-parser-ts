# Build from repository root (pnpm workspace; this package alone is not enough context):
#   docker build -f packages/dbt-tools/web/Dockerfile -t dbt-tools-web:local .
# Run:
#   docker run --rm -p 8080:8080 dbt-tools-web:local
#
# lockfileVersion 9.x in pnpm-lock.yaml requires pnpm 9.x.
# Runtime: nginx official unprivileged image (non-root); satisfies trivy DS-0002.

FROM node:24-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node packages/dbt-artifacts-parser/package.json ./packages/dbt-artifacts-parser/
COPY --chown=node:node packages/dbt-tools/cli/package.json ./packages/dbt-tools/cli/
COPY --chown=node:node packages/dbt-tools/core/package.json ./packages/dbt-tools/core/
COPY --chown=node:node packages/dbt-tools/web/package.json ./packages/dbt-tools/web/

USER node

RUN pnpm install --frozen-lockfile

COPY --chown=node:node . .

RUN pnpm --filter @dbt-tools/web build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY packages/dbt-tools/web/nginx-docker.conf /etc/nginx/conf.d/default.conf
COPY --from=builder --chown=nginx:nginx /app/packages/dbt-tools/web/dist /usr/share/nginx/html

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/ > /dev/null || exit 1
