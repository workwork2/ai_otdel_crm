# AI Отдел — монорепозиторий

Продукт: **AI Отдел** (панель организации + control plane). Технически: **NestJS API**, **Next.js** (CRM и супер-админка), **PostgreSQL**.

**Архитектура и соглашения:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Переменные окружения: [`.env.example`](.env.example), `apps/api/.env.example`, `apps/web/.env.example`.

## Пакеты workspace (имена для `npm run … -w …`)

| Папка | `name` в `package.json` |
|-------|-------------------------|
| `apps/api` | `tenant-api` |
| `apps/web` | `web` |

## Требования

- Node.js 20+ (в Docker-образах используется 22)
- Docker Desktop — для PostgreSQL или полного стека

## Быстрый старт (локально, два процесса)

1. Установка зависимостей (из корня):

   ```bash
   npm install
   ```

2. Поднять только PostgreSQL:

   ```bash
   npm run postgres:up
   ```

3. Скопировать примеры env (один раз):

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```

   В `apps/api/.env` проверьте `DATABASE_URL` (для контейнера Postgres из compose: `postgresql://linearize:linearize@localhost:5432/linearize`).

4. Запуск **API + Next одной командой**:

   ```bash
   npm run dev:full
   ```

   Либо в **двух терминалах**:

   ```bash
   npm run dev:api
   npm run dev:web
   ```

5. Открыть в браузере:

   - CRM (панель организации): [http://localhost:3000](http://localhost:3000)
   - Control Plane (платформа): [http://localhost:3000/platform/login](http://localhost:3000/platform/login) (первый визит — bootstrap главного админа)
   - API health: [http://localhost:3333/v1/health](http://localhost:3333/v1/health)

Если API на удалённой БД и проверка `pg-ping` не нужна:

```bash
SKIP_DB_CHECK=1 npm run dev:api
```

## Весь стек в Docker

```bash
cp .env.docker.example .env
npm run docker:up
```

После сборки: те же URL, что выше. Ключ супер-админки в `.env` должен совпадать с `NEXT_PUBLIC_SUPER_ADMIN_KEY` при сборке (пересоберите образ после смены).

## Полезные команды

| Команда | Назначение |
|--------|------------|
| `npm run dev` / `dev:web` | Next :3000 — CRM + `/platform` (`web`) |
| `npm run dev:api` | API :3333 (`tenant-api`, с проверкой локального Postgres) |
| `npm run dev:full` | API + Next |
| `npm run build` | Сборка всех workspace |
| `npm run postgres:up` / `postgres:stop` | PostgreSQL в Docker |
| `npm run docker:up` / `docker:down` | Полный compose-стек |

## ИИ и почта

В `apps/api/.env` задайте хотя бы один ключ: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` или `GEMINI_API_KEY` — для ответов ИИ на API. Для рассылок удержания — блок `SMTP_*` (см. комментарии в `apps/api/.env.example`).

На клиенте опционально: `NEXT_PUBLIC_GEMINI_API_KEY` в `apps/web/.env.local` — запасной путь для кнопок «Доработать с ИИ», если API недоступен.
