FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
ARG APP_VERSION=dev
ARG APP_REVISION=unknown
ENV APP_VERSION=${APP_VERSION}
ENV APP_REVISION=${APP_REVISION}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=5555

LABEL org.opencontainers.image.source="https://github.com/finenumbers/pstn"
LABEL org.opencontainers.image.title="PSTN Analytics"
LABEL org.opencontainers.image.vendor="Finenumbers"

RUN apk add --no-cache postgresql-client su-exec ca-certificates wget && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /app/.secrets && chown nextjs:nodejs /app/.secrets

COPY certs/mincifry/*.crt /usr/local/share/ca-certificates/
RUN update-ca-certificates

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/packages/db/migrations ./packages/db/migrations
COPY data/opr ./data/opr
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
ENV OPR_CSV_PATH=/app/data/opr/OPR_2026_06_18_00_00_00.csv
RUN chmod +x /docker-entrypoint.sh

EXPOSE 5555

ENTRYPOINT ["/docker-entrypoint.sh"]
