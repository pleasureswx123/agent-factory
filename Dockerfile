FROM node:22-bookworm-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile

ARG NEXT_PUBLIC_RUNTIME_URL=http://127.0.0.1:4001
ENV NEXT_PUBLIC_RUNTIME_URL=$NEXT_PUBLIC_RUNTIME_URL

RUN pnpm build

FROM node:22-bookworm-slim AS app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production

WORKDIR /app

RUN corepack enable

COPY --from=builder /app /app

EXPOSE 3000 4001

CMD ["pnpm", "--filter", "@agent-os/web", "start"]
