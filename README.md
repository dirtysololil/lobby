# Lobby Stage 5

Private communication platform on `pnpm` monorepo.

## Stack

- `apps/web`: Next.js App Router + TypeScript
- `apps/api`: NestJS + TypeScript
- `packages/shared`: shared types, DTO and zod schemas
- `packages/config`: env parsing
- PostgreSQL + Prisma
- Redis + BullMQ
- Cookie session auth + Argon2id
- Hubs, forum, DM, LiveKit calls
- Avatar presets + safe avatar uploads
- Owner/admin dashboard + audit log

## Local run

1. Copy `.env.example` to `.env`
2. Ensure PostgreSQL, Redis and LiveKit are reachable
3. Install packages

```bash
corepack pnpm install
```

4. Generate Prisma client

```bash
corepack pnpm prisma:generate
```

5. Apply migrations

```bash
corepack pnpm prisma:migrate:dev
```

6. Seed owner, admin and invite keys

```bash
corepack pnpm db:seed
```

7. Start web and api

```bash
corepack pnpm dev
```

8. Start BullMQ worker

```bash
corepack pnpm dev:worker
```

## What is in stage 5

- invite-only registration and cookie session auth
- private user search, friendships, blocks and DM
- hubs, private lobbies and forum topics
- LiveKit DM and lobby calls
- avatar presets: `gold glow`, `neon blue`, `premium purple`, `animated ring`
- safe avatar uploads with format, size, frame and duration checks
- notification settings for DM, hub and lobby
- owner/admin dashboard for invites, users, moderation and audit log

## Useful commands

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm dev:worker
corepack pnpm start:worker
corepack pnpm prisma:studio
corepack pnpm --filter @lobby/api test:e2e
```

## Manual check

1. Run `corepack pnpm db:seed`
2. Register a member through `SEED_MEMBER_INVITE_KEY`
3. Open `/app/settings/profile` and upload a safe avatar
4. Switch avatar preset and verify it in sidebar/header
5. Open `/app/settings/notifications` and change DM/hub/lobby settings
6. Login as seeded owner/admin and open `/app/admin`
7. Create or revoke invite keys under `/app/admin/invites`
8. Block and unblock a member under `/app/admin/users`
9. Review moderation and auth entries under `/app/admin/audit`
