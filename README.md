# Lobby

Приватный проект. README - рабочая шпаргалка по запуску, обновлению после `git pull`, переносу на другой хостинг и поиску нужных файлов.

## Стек

- Monorepo: `pnpm` workspaces, Node.js, TypeScript.
- Frontend: `apps/web` - Next.js 16, React 19, App Router, CSS в `apps/web/src/app/globals.css`.
- Backend: `apps/api` - NestJS 11, REST API, Socket.IO gateway, worker для очередей.
- Shared: `packages/shared` - общие DTO, типы и схемы.
- Config: `packages/config` - чтение и валидация `.env`.
- Database: MySQL через Prisma, схема и миграции в `prisma`.
- Queue/cache: Redis + BullMQ.
- Calls/realtime media: LiveKit.
- Process manager: PM2, конфиг в `ecosystem.config.cjs`.

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

1. Поставить системные зависимости: Node.js совместимый с проектом, `corepack`, MySQL, Redis, PM2, nginx или другой reverse proxy.
2. Склонировать репозиторий и перейти в папку проекта.
3. Создать `.env` на основе текущего сервера или `.env.example`, если он появится.
4. Установить зависимости и сгенерировать Prisma client:

```bash
corepack enable
corepack pnpm install
corepack pnpm prisma:generate
```

5. Поднять базу:

```bash
corepack pnpm prisma:migrate:deploy
corepack pnpm db:seed
```

Если база уже была создана вручную или через `prisma db push`, один раз отметить baseline:

```bash
corepack pnpm prisma:migrate:resolve:baseline
corepack pnpm db:seed
```

6. Собрать проект:

```bash
corepack pnpm build
```

7. Запустить через PM2:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
```

## Разработка

```bash
corepack pnpm dev
corepack pnpm dev:worker
```

- web: `http://127.0.0.1:3000`
- api: `http://127.0.0.1:3001`

Отдельные полезные команды:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm --filter @lobby/api test
corepack pnpm prisma:studio
```

## Прод-сборка и ручной запуск

```bash
corepack pnpm build
corepack pnpm start:api
corepack pnpm start:web
corepack pnpm start:worker
```

Обычно в проде вручную так не держать процессы, а запускать через PM2.

## Обновление после `git pull`

Стандартный порядок на этом сервере:

```bash
PROJECT_DIR=/home/Dirtysolo/web/lobby.webmason.ru/public_html
cd "$PROJECT_DIR"
git pull
corepack pnpm install --frozen-lockfile
corepack pnpm prisma:migrate:deploy
corepack pnpm build
pm2 restart ecosystem.config.cjs --update-env
pm2 save
```

Если точно не менялись `package.json` и `pnpm-lock.yaml`, можно пропустить `corepack pnpm install --frozen-lockfile`.

Если менялись Prisma schema или зависимости Prisma:

```bash
corepack pnpm prisma:generate
corepack pnpm prisma:migrate:deploy
corepack pnpm build
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

На новом сервере обязательно проверить `.env`:

- `WEB_PUBLIC_URL` - публичный URL фронта.
- `API_PUBLIC_URL` - публичный URL API.
- `MEDIA_PUBLIC_URL` - URL медиа/realtime, если используется отдельно.
- `REALTIME_PUBLIC_URL`, `REALTIME_PATH`, `REALTIME_CORS_ORIGIN` - realtime настройки.
- `DATABASE_URL` - MySQL подключение.
- `REDIS_URL`, `BULLMQ_PREFIX` - Redis и очереди.
- `SESSION_SECRET`, `SESSION_COOKIE_NAME`, `SESSION_COOKIE_DOMAIN` - сессии и cookie.
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` - звонки.
- `UPLOAD_DRIVER`, `UPLOAD_LOCAL_ROOT` - хранение файлов.
- `SEED_*` - начальные пользователи и invite keys, нужны для seed.

В `ecosystem.config.cjs` проверить:

- `cwd` у процессов: на этом сервере путь проекта `/home/Dirtysolo/web/lobby.webmason.ru/public_html`; при переносе подставить новый путь.
- путь к `pnpm`, если на сервере он не `/usr/local/bin/pnpm`.
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
corepack pnpm --filter @lobby/api owner:invite
```

Перегенерировать Prisma client:

```bash
corepack pnpm prisma:generate
```

Проверить Prisma schema:

```bash
corepack pnpm prisma:validate
```

Пересобрать только frontend:

```bash
corepack pnpm --filter @lobby/web build
pm2 restart lobby-web --update-env
```

Пересобрать только API:

```bash
corepack pnpm --filter @lobby/api build
pm2 restart lobby-api --update-env
pm2 restart lobby-worker --update-env
```

## Если что-то сломалось

- `pm2 status` - понять, какой процесс упал.
- `pm2 logs lobby-api --lines 200` - API, Prisma, Redis, LiveKit, auth.
- `pm2 logs lobby-web --lines 200` - Next.js frontend.
- `pm2 logs lobby-worker --lines 200` - очереди и фоновые задачи.
- `corepack pnpm prisma:migrate:deploy` - проверить, что миграции применены.
- `corepack pnpm prisma:generate` - обновить Prisma client после изменения схемы.
- `corepack pnpm build` - поймать ошибки TypeScript/Next/Nest до рестарта.
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
git add README.md
git commit -m "docs: expand operations readme"
git push
```

Если на сервере есть локальные изменения, не делать `git reset --hard`, пока не понятно, чьи это изменения и нужны ли они.
