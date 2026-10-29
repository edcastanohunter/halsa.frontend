# syntax=docker/dockerfile:1
# Backoffice image (plan §10.2). Build context: the repository root.
#   docker build -f deploy/backoffice/Dockerfile -t halsa-backoffice .
# Runtime env: HALSA_KEYCLOAK_AUTHORITY (required), HALSA_API_BASE_URL, HALSA_KEYCLOAK_CLIENT_ID.

# The output is static JS: build natively on the runner and only the nginx stage is per-arch.
FROM --platform=$BUILDPLATFORM node:22.23.4-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
# The lockfile is written by the npm in package.json "packageManager"; npm 10 (node 22) rejects it.
RUN npm install -g npm@11.6.2 && npm ci --no-audit --no-fund
COPY angular.json tsconfig.json .postcssrc.json ./
COPY libs libs
COPY projects/backoffice projects/backoffice
COPY scripts/check-bundles.mjs scripts/
# Production build + gzip budgets and the no-mock check; config.json is generated at start.
RUN npx ng build backoffice \
    && node scripts/check-bundles.mjs backoffice \
    && rm dist/backoffice/browser/config.json

FROM nginxinc/nginx-unprivileged:1.30.6-alpine
ENV HALSA_APP=backoffice
COPY --chmod=0755 deploy/nginx/16-halsa.envsh /docker-entrypoint.d/
COPY deploy/nginx/default.conf.template deploy/nginx/seguridad.inc.template /etc/nginx/templates/
COPY --from=build /src/dist/backoffice/browser /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
