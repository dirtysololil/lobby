# Lobby

Приватный проект. README - рабочая шпаргалка по запуску, обновлению после `git pull`, переносу на другой хостинг и поиску нужных файлов.

Данные ниже сверены с реальным состоянием репозитория и сервера: `package.json`, `apps/*/package.json`, `scripts/build.mjs`, `ecosystem.config.cjs`, текущими PM2-процессами и ключами `.env` без значений секретов.

## Стек

- Monorepo: `pnpm` workspaces, Node.js, TypeScript.
- Frontend: `apps/web` - Next.js 16.2.2, React 19.2.4, App Router, CSS в `apps/web/src/app/globals.css`, Capacitor для iOS/Android.
- Backend: `apps/api` - NestJS 11, REST API, Socket.IO gateway, worker для очередей.
- Shared: `packages/shared` - общие DTO, типы и схемы.
- Config: `packages/config` - чтение и валидация `.env`.
- Database: MySQL через Prisma, схема и миграции в `prisma`.
- Queue/cache: Redis + BullMQ.
- Calls/realtime media: LiveKit.
- Process manager: PM2, конфиг в `ecosystem.config.cjs`.

## Фактическое окружение сервера

- Проект лежит в `/home/Dirtysolo/web/lobby.webmason.ru/public_html`.
- Git: локальная ветка `master`, upstream `origin/main`.
- `pnpm` установлен как `/usr/local/bin/pnpm`, версия `10.33.0`.
- `corepack` на сервере отсутствует, поэтому команды запускаются напрямую через `pnpm`.
- Для сборки нужен Node.js `>=20.9.0`. Системный `/usr/bin/node` сейчас `v18.19.1` и не подходит для Next.js 16.
- Рабочий Node.js для сборки и PM2 web: `v20.20.2` из `/root/.npm/_npx/ebaba8b9e55fd0a9/node_modules/node/bin/node`.

Перед install/build на текущем сервере выставить Node 20 в `PATH`:

```bash
export PATH=/root/.npm/_npx/ebaba8b9e55fd0a9/node_modules/node/bin:$PATH
node -v
pnpm -v
```

Ожидаемые версии после `export PATH`: `node v20.20.2`, `pnpm 10.33.0`.

## Фактическая сборка

Корневой `pnpm build` запускает `scripts/build.mjs`. Реальный порядок:

1. `prisma generate --schema prisma/schema.prisma`.
2. TypeScript build для `packages/shared`.
3. TypeScript build для `packages/config`.
4. Очистка `apps/api/dist`.
5. NestJS build для `apps/api`.
6. Очистка `apps/web/.next`.
7. Next.js build для `apps/web`.
8. `apps/web/scripts/prepare-standalone-assets.mjs`.

На текущем сервере перед сборкой нужен Node 20 в `PATH`:

```bash
export PATH=/root/.npm/_npx/ebaba8b9e55fd0a9/node_modules/node/bin:$PATH
pnpm build
```

## Фактический PM2-запуск

- `lobby-api`: `online`, cwd `/home/Dirtysolo/web/lobby.webmason.ru/public_html`, script `/usr/local/bin/pnpm`, args `--filter @lobby/api start:prod`.
- `lobby-web`: `online`, cwd `/home/Dirtysolo/web/lobby.webmason.ru/public_html`, standalone server `apps/web/.next/standalone/apps/web/server.js`, interpreter Node `20.20.2`, `HOSTNAME=127.0.0.1`, `PORT=3000`. В `ecosystem.config.cjs` web запускается напрямую из standalone-файла, а не через системный Node 18.
- `lobby-worker`: `online`, cwd `/home/Dirtysolo/web/lobby.webmason.ru/public_html`, script `/usr/local/bin/pnpm`, args `--filter @lobby/api start:worker`.

Проверка:

```bash
pm2 status
pm2 describe lobby-api
pm2 describe lobby-web
pm2 describe lobby-worker
```

## Что где менять

- Страницы сайта: `apps/web/src/app`.
- Основной app layout: `apps/web/src/app/layout.tsx`, защищенная часть приложения - `apps/web/src/app/app/layout.tsx`.
- Главная после входа: `apps/web/src/app/app/home/page.tsx`, компоненты рядом в `apps/web/src/components/home`.
- Логин и регистрация: `apps/web/src/app/login`, `apps/web/src/app/register`, формы в `apps/web/src/components/auth`.
- Сообщения: `apps/web/src/app/app/messages`, компоненты в `apps/web/src/components/messages`.
- Хабы, лобби и форум: `apps/web/src/app/app/hubs`, компоненты в `apps/web/src/components/hubs` и `apps/web/src/components/forum`.
- Админка: страницы в `apps/web/src/app/app/admin`, компоненты в `apps/web/src/components/admin`.
- Настройки: `apps/web/src/app/app/settings`, компоненты в `apps/web/src/components/settings`.
- Люди и профили: `apps/web/src/app/app/people`, `apps/web/src/components/people`, `apps/web/src/components/profile`.
- Навигация приложения: `apps/web/src/components/app/app-sidebar.tsx`, `app-mobile-top-nav.tsx`, `app-context-rail.tsx`, `quick-launcher.tsx`.
- Админ-навигация: `apps/web/src/lib/admin-navigation.ts` и `apps/web/src/components/admin/admin-section-nav.tsx`.
- Роуты хабов и профилей: `apps/web/src/lib/hub-routes.ts`, `apps/web/src/lib/profile-routes.ts`.
- UI-примитивы: `apps/web/src/components/ui`.
- Общие стили и CSS tokens: `apps/web/src/app/globals.css`.
- Правила дизайна: `DESIGN.md`. Перед UI-правками читать его, не вводить второй визуальный стиль.
- API-модули: `apps/api/src/modules`.
- Авторизация: `apps/api/src/modules/auth`.
- Пользователи/admin/invites: `apps/api/src/modules/admin`, `apps/api/src/modules/invites`.
- Медиа, стикеры и загрузки: `apps/api/src/modules/media-library`, `apps/api/src/modules/stickers`.
- Звонки и realtime: `apps/api/src/modules/calls`, frontend provider в `apps/web/src/components/realtime`.
- Prisma schema: `prisma/schema.prisma`.
- Seed: `prisma/seed.ts`.
- Скрипты сборки/Prisma: `scripts`.

## Быстрый старт на новом месте

1. Поставить системные зависимости: Node.js `>=20.9.0`, `pnpm` `10.33.0`, MySQL, Redis, PM2, nginx или другой reverse proxy.
2. Склонировать репозиторий и перейти в папку проекта.
3. Создать `.env` на основе текущего сервера или `.env.example`, если он появится.
4. Установить зависимости и сгенерировать Prisma client:

```bash
pnpm install --frozen-lockfile
pnpm prisma:generate
```

5. Поднять базу:

```bash
pnpm prisma:migrate:deploy
pnpm db:seed
```

Если база уже была создана вручную или через `prisma db push`, один раз отметить baseline:

```bash
pnpm prisma:migrate:resolve:baseline
pnpm db:seed
```

6. Собрать проект:

```bash
pnpm build
```

7. Запустить через PM2:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
```

## Разработка

```bash
pnpm dev
pnpm dev:worker
```

- web: `http://127.0.0.1:3000`
- api: `http://127.0.0.1:3001`

Отдельные полезные команды:

```bash
pnpm lint
pnpm typecheck
pnpm --filter @lobby/api test
pnpm --filter @lobby/api test:e2e
pnpm prisma:validate
pnpm prisma:studio
```

## Windows-приложение

Desktop-оболочка находится в `apps/desktop`. Она не встраивает web/API внутрь
приложения, а открывает продовый Lobby-сайт как отдельную Windows-программу.
Перед запуском или сборкой публичные адреса берутся из корневого `.env`
(`WEB_PUBLIC_URL`, `API_PUBLIC_URL`, `MEDIA_PUBLIC_URL`,
`REALTIME_PUBLIC_URL`). Так основной функционал сайта остается общим для
браузера, Android/iOS и Windows.

Проверить Electron-оболочку в dev-режиме:

```bash
corepack pnpm desktop:dev
```

Собрать portable `.exe` для Windows:

```bash
corepack pnpm desktop:dist
```

Готовый файл появится в `apps/desktop/dist`. Для сборки установщика вместо
portable-версии:

```bash
corepack pnpm desktop:dist:installer
```

Если сервер изменится, пересобирать приложение не обязательно. Положить рядом с
`.exe` файл `desktop.config.json` по образцу `apps/desktop/desktop.config.example.json`:

```json
{
  "appUrl": "https://lobby.webmason.ru",
  "allowedOrigins": [
    "https://api.lobby.webmason.ru",
    "https://media.lobby.webmason.ru",
    "wss://media.lobby.webmason.ru"
  ]
}
```

Для разового запуска можно переопределить адрес через переменные окружения:

```powershell
$env:LOBBY_DESKTOP_URL = "https://lobby.webmason.ru"
$env:LOBBY_DESKTOP_ALLOWED_ORIGINS = "https://api.lobby.webmason.ru,https://media.lobby.webmason.ru,wss://media.lobby.webmason.ru"
corepack pnpm desktop:dev
```

## Прод-сборка и ручной запуск

```bash
pnpm build
pnpm start:api
pnpm start:web
pnpm start:worker
```

Обычно в проде вручную так не держать процессы, а запускать через PM2.

`pnpm start:web` использует `apps/web/scripts/run-next.mjs start`. В PM2 web запускается напрямую из standalone-сборки: `apps/web/.next/standalone/apps/web/server.js`.

## Обновление после `git pull`

Стандартный порядок на этом сервере:

```bash
PROJECT_DIR=/home/Dirtysolo/web/lobby.webmason.ru/public_html
cd "$PROJECT_DIR"
export PATH=/root/.npm/_npx/ebaba8b9e55fd0a9/node_modules/node/bin:$PATH
git pull
pnpm install --frozen-lockfile
pnpm prisma:migrate:deploy
pnpm build
pm2 restart ecosystem.config.cjs --update-env
pm2 save
```

Если точно не менялись `package.json` и `pnpm-lock.yaml`, можно пропустить `pnpm install --frozen-lockfile`.

Если менялись Prisma schema или зависимости Prisma:

```bash
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm build
pm2 restart ecosystem.config.cjs --update-env
```

Проверка после обновления:

```bash
pm2 status
pm2 logs lobby-api --lines 100
pm2 logs lobby-worker --lines 100
pm2 logs lobby-web --lines 100
```

Если сайт открывается, но API/realtime не работает, сначала проверять `.env`, nginx proxy, Redis, LiveKit и логи `lobby-api`.

## Восстановление сломанного сайта

Самая частая поломка frontend на этом сервере: `lobby-web` в PM2 имеет статус `errored`, а в логах есть ошибка:

```text
Cannot find module '/home/Dirtysolo/web/lobby.webmason.ru/public_html/apps/web/.next/standalone/apps/web/server.js'
```

Это значит, что Next standalone-сборка отсутствует или была удалена. Исправление:

```bash
PROJECT_DIR=/home/Dirtysolo/web/lobby.webmason.ru/public_html
cd "$PROJECT_DIR"
export PATH=/root/.npm/_npx/ebaba8b9e55fd0a9/node_modules/node/bin:$PATH
pnpm build
test -f apps/web/.next/standalone/apps/web/server.js
pm2 restart lobby-web --update-env
pm2 status
curl -I http://127.0.0.1:3000
curl -I https://lobby.webmason.ru
```

Ожидаемый результат: `lobby-web` в `online`, оба `curl` возвращают `200 OK`.

Если `pnpm build` падает:

```bash
export PATH=/root/.npm/_npx/ebaba8b9e55fd0a9/node_modules/node/bin:$PATH
node -v
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm build
```

Если PM2-конфиг менялся или процесс нужно пересоздать из `ecosystem.config.cjs`:

```bash
pm2 startOrRestart ecosystem.config.cjs --update-env
pm2 save
```

Не запускать сборку системным `/usr/bin/node v18.19.1`: для текущего Next.js нужен Node `>=20.9.0`.

## Перенос на другой хостинг

Минимальный чеклист:

1. Забрать код из git.
2. Перенести `.env` и заменить домены/пути под новый сервер.
3. Перенести MySQL базу.
4. Перенести загруженные файлы из `UPLOAD_LOCAL_ROOT`, если используется локальное хранение.
5. Поднять Redis.
6. Поднять или перенастроить LiveKit.
7. Установить зависимости, применить миграции, собрать проект.
8. Настроить nginx/reverse proxy на web и api.
9. Запустить PM2 и проверить логи.

Пример переноса MySQL:

```bash
mysqldump -u USER -p DATABASE_NAME > lobby.sql
mysql -u USER -p NEW_DATABASE_NAME < lobby.sql
```

Пример переноса uploads:

```bash
rsync -avz /old/upload/path/ user@new-host:/new/upload/path/
```

На новом сервере обязательно проверить `.env`. Фактические ключи текущего `.env`; значения секретов в git не хранить:

```text
APP_NAME
NODE_ENV
WEB_PUBLIC_URL
API_PUBLIC_URL
MEDIA_PUBLIC_URL
REALTIME_PUBLIC_URL
REALTIME_PATH
WEB_HOST
WEB_PORT
API_HOST
API_PORT
DATABASE_URL
REDIS_URL
BULLMQ_PREFIX
SESSION_SECRET
SESSION_COOKIE_NAME
SESSION_COOKIE_DOMAIN
SESSION_TTL_DAYS
ARGON2_MEMORY_COST
ARGON2_TIME_COST
ARGON2_PARALLELISM
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
LIVEKIT_TOKEN_TTL_MINUTES
CALL_RING_TIMEOUT_SECONDS
UPLOAD_DRIVER
UPLOAD_LOCAL_ROOT
MAX_AVATAR_MB
MAX_FILE_MB
MAX_AVATAR_FRAMES
MAX_AVATAR_ANIMATION_MS
MAX_CUSTOM_EMOJI_MB
MAX_CUSTOM_EMOJI_DIMENSION
MAX_STICKER_MB
MAX_STICKER_DIMENSION
MAX_STICKER_FRAMES
MAX_STICKER_ANIMATION_MS
MAX_GIF_MB
MAX_GIF_DIMENSION
MAX_GIF_FRAMES
MAX_GIF_ANIMATION_MS
REALTIME_CORS_ORIGIN
SEED_OWNER_EMAIL
SEED_OWNER_USERNAME
SEED_OWNER_DISPLAY_NAME
SEED_OWNER_PASSWORD
SEED_ADMIN_EMAIL
SEED_ADMIN_USERNAME
SEED_ADMIN_DISPLAY_NAME
SEED_ADMIN_PASSWORD
SEED_OWNER_INVITE_KEY
SEED_ADMIN_INVITE_KEY
SEED_MEMBER_INVITE_KEY
```

В `ecosystem.config.cjs` проверить:

- `cwd` у процессов: на этом сервере путь проекта `/home/Dirtysolo/web/lobby.webmason.ru/public_html`; при переносе подставить новый путь.
- путь к `pnpm`: на этом сервере `/usr/local/bin/pnpm`.
- Node.js для сборки должен быть `>=20.9.0`; на этом сервере для ручной сборки используется `export PATH=/root/.npm/_npx/ebaba8b9e55fd0a9/node_modules/node/bin:$PATH`.
- `HOSTNAME`, `PORT` для `lobby-web`.
- имена процессов `lobby-api`, `lobby-web`, `lobby-worker`.

## Reverse proxy

Типовая схема:

- `lobby-web` слушает `127.0.0.1:3000`.
- `lobby-api` слушает порт из `.env`, обычно `127.0.0.1:3001`.
- nginx проксирует публичный домен фронта на web.
- nginx проксирует API-домен или API-путь на NestJS.
- WebSocket/Socket.IO пути должны проксироваться с upgrade headers.

Что гуглить при настройке:

- `nginx reverse proxy nextjs standalone pm2`
- `nginx proxy websocket socket.io nestjs`
- `pm2 ecosystem config cwd env update-env`
- `prisma migrate deploy production mysql`
- `redis bullmq production systemd`
- `livekit self hosting nginx`

## Частые операции

Создать ручной инвайт владельца:

```bash
pnpm --filter @lobby/api owner:invite
```

Перегенерировать Prisma client:

```bash
pnpm prisma:generate
```

Проверить Prisma schema:

```bash
pnpm prisma:validate
```

Пересобрать только frontend:

```bash
export PATH=/root/.npm/_npx/ebaba8b9e55fd0a9/node_modules/node/bin:$PATH
pnpm --filter @lobby/web build
pm2 restart lobby-web --update-env
```

Пересобрать только API:

```bash
export PATH=/root/.npm/_npx/ebaba8b9e55fd0a9/node_modules/node/bin:$PATH
pnpm --filter @lobby/api build
pm2 restart lobby-api --update-env
pm2 restart lobby-worker --update-env
```

## Если что-то сломалось

- `pm2 status` - понять, какой процесс упал.
- `pm2 logs lobby-api --lines 200` - API, Prisma, Redis, LiveKit, auth.
- `pm2 logs lobby-web --lines 200` - Next.js frontend.
- `pm2 logs lobby-worker --lines 200` - очереди и фоновые задачи.
- `pnpm prisma:migrate:deploy` - проверить, что миграции применены.
- `pnpm prisma:generate` - обновить Prisma client после изменения схемы.
- `pnpm build` - поймать ошибки TypeScript/Next/Nest до рестарта.
- Проверить, что `.env` реально подхватился: после изменения env всегда использовать `pm2 restart ... --update-env`.

## Git-памятка

Перед работой:

```bash
git status
git pull
```

После своих изменений:

```bash
git status
git add README.md package.json ecosystem.config.cjs
git commit -m "docs: document actual production setup"
git push
```

Если на сервере есть локальные изменения, не делать `git reset --hard`, пока не понятно, чьи это изменения и нужны ли они.
