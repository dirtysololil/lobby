# Lobby

Приватный проект. README оставлен как короткая шпаргалка для быстрого старта и обслуживания.

## Что где

- `apps/web` - фронт на Next.js
- `apps/api` - API на NestJS
- `packages/shared` - общие типы, DTO и схемы
- `packages/config` - загрузка и валидация env
- `prisma` - схема, миграции и seed

## Быстрый старт

1. Проверить `.env` и при необходимости обновить его по примеру из `.env.example`.
2. Установить зависимости:

```bash
corepack pnpm install
corepack pnpm prisma:generate
```

3. Поднять базу.

Для новой MySQL:

```bash
corepack pnpm prisma:migrate:deploy
corepack pnpm db:seed
```

Если база уже была выровнена через `prisma db push`, один раз отметить baseline:

```bash
corepack pnpm prisma:migrate:resolve:baseline
corepack pnpm db:seed
```

## Разработка

```bash
corepack pnpm dev
corepack pnpm dev:worker
```

- `web`: `http://127.0.0.1:3000`
- `api`: `http://127.0.0.1:3001`

## Прод-сборка и запуск

```bash
corepack pnpm build
corepack pnpm start:api
corepack pnpm start:web
corepack pnpm start:worker
```

## Подсказки для меня

- После изменений в Prisma почти всегда нужно выполнить `corepack pnpm prisma:generate`.
- `db:seed` создает `owner`, `admin` и инвайт-коды из переменных в `.env`.
- Если не работают очереди или realtime, сначала проверить `REDIS_URL`, `REALTIME_*`, `LIVEKIT_*`.
- Для ручного инвайта владельца есть команда: `corepack pnpm --filter @lobby/api owner:invite`.
- Для PM2:

```bash
pm2 start ecosystem.config.cjs
pm2 status
pm2 save
```
