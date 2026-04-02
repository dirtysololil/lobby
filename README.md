# Lobby Stage 4

Private communication platform foundation on `pnpm` monorepo.

## Stack

- `apps/web`: Next.js App Router + TypeScript
- `apps/api`: NestJS + TypeScript
- `packages/shared`: shared types, enums, zod schemas, DTO
- `packages/config`: env parsing
- PostgreSQL + Prisma
- Redis + BullMQ
- Cookie session auth + Argon2id
- Friendships + blocks
- Direct messages + retention cleanup worker
- Hubs + forum lobbies
- LiveKit calls for DM and voice lobby
- Realtime signaling through websocket gateway

## Local run

1. Copy `.env.example` to `.env` and fill real values.
2. Ensure PostgreSQL, Redis and LiveKit server are running and reachable.
3. Install dependencies:

```bash
corepack pnpm install
```

4. Generate Prisma client:

```bash
corepack pnpm prisma:generate
```

5. Apply migrations:

```bash
corepack pnpm prisma:migrate:dev
```

6. Seed owner, admin and invite keys:

```bash
corepack pnpm db:seed
```

7. Start apps:

```bash
corepack pnpm dev
```

8. Start worker:

```bash
corepack pnpm dev:worker
```

## Auth flow

- registration is allowed only with a valid invite key
- login works by `username` or `email`
- session is stored in `HttpOnly` cookie
- owner/admin can manage invite keys through API
- friendships and DM are private by username search only
- block state forbids direct interaction endpoints
- DM retention cleanup runs through BullMQ worker sweep job
- DM audio/video calls and voice lobby group calls use LiveKit only
- API issues LiveKit participant tokens
- websocket signaling announces ringing, accepted, declined, ended and missed states

## Useful commands

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm dev:worker
corepack pnpm start:worker
corepack pnpm prisma:studio
corepack pnpm --filter @lobby/api owner:invite
```

## Manual check

1. Run `corepack pnpm db:seed`
2. Use `SEED_MEMBER_INVITE_KEY` on `/register`
3. After registration open `/app/people` and search seeded users by username
4. Send and accept a friend request
5. Open `/app/messages`, create DM and send a message
6. Update DM retention and notification settings
7. Start DM audio/video call and accept it from the second account
8. Open a voice lobby and verify group call join plus screen share
9. Login/logout should rotate access through session cookie
10. As seeded owner/admin call invite endpoints under `/v1/invites`
