# Lobby

Private communication platform on `pnpm` monorepo.

## Stack

- `apps/web`: Next.js App Router + TypeScript
- `apps/api`: NestJS + TypeScript
- `packages/shared`: shared DTO, enums and zod schemas
- `packages/config`: env loading and parsing
- MySQL + Prisma
- Redis + BullMQ
- LiveKit

## MySQL migration strategy

- Old PostgreSQL migration history removed from the repo
- Repository now contains single MySQL baseline migration: `20260402170000_mysql_baseline`
- For a fresh database use `prisma migrate deploy`
- For an existing MySQL database that was already aligned through `prisma db push`, mark the baseline once with `prisma:migrate:resolve:baseline`

## Install

```bash
corepack pnpm install
corepack pnpm prisma:generate
```

## Database

Fresh MySQL database:

```bash
corepack pnpm prisma:migrate:deploy
corepack pnpm db:seed
```

Existing MySQL database already matching the schema:

```bash
corepack pnpm prisma:migrate:resolve:baseline
corepack pnpm db:seed
```

## Build

```bash
corepack pnpm build
```

## Run

```bash
corepack pnpm start:api
corepack pnpm start:web
corepack pnpm start:worker
```

`api` binds to `127.0.0.1:3001`, `web` binds to `127.0.0.1:3000`.

## PM2

```bash
pm2 start ecosystem.config.cjs
pm2 status
pm2 save
```
