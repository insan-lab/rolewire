# Rolewire admin panel (Next.js). Standalone output mode (frontend spec §9).
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, not read at container
# start — they must be build args, not `environment:` in compose (frontend spec §9).
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
ARG NEXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox
ARG NEXT_PUBLIC_SUPPORT_EMAIL=support@rolewire.io
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=$NEXT_PUBLIC_PADDLE_CLIENT_TOKEN \
    NEXT_PUBLIC_PADDLE_ENVIRONMENT=$NEXT_PUBLIC_PADDLE_ENVIRONMENT \
    NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL \
    NEXT_OUTPUT_STANDALONE=1 \
    NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 10001 rolewire && adduser --system --uid 10001 --ingroup rolewire rolewire

COPY --from=builder --chown=rolewire:rolewire /app/.next/standalone ./
COPY --from=builder --chown=rolewire:rolewire /app/.next/static ./.next/static
COPY --from=builder --chown=rolewire:rolewire /app/public ./public

USER rolewire
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000/login >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
