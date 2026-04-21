# Linearize AI Dashboard

Монорепозиторий: **NestJS API** (`apps/api`), панель клиентов **Next.js** (`apps/user-dashboard`, порт 3000), **супер-админка** (`apps/super-admin`, порт 3001), **PostgreSQL**.

Подробные переменные окружения — в [`.env.example`](.env.example) и в `apps/*/.env.example`.

## Требования

- Node.js 20+ (в Docker-образах используется 22)
- Docker Desktop — для PostgreSQL или полного стека

## Быстрый старт (локально, три процесса)

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
   cp apps/user-dashboard/.env.example apps/user-dashboard/.env.local
   cp apps/super-admin/.env.example apps/super-admin/.env.local
   ```

   В `apps/api/.env` проверьте `DATABASE_URL` (для контейнера Postgres из compose: `postgresql://linearize:linearize@localhost:5432/linearize`).

4. Запуск **API + оба фронта одной командой**:

   ```bash
   npm run dev:full
   ```

   Либо в **трёх терминалах**:

   ```bash
   npm run dev:api
   npm run dev:user
   npm run dev:admin
   ```

5. Открыть в браузере:

   - Клиентская панель: [http://localhost:3000](http://localhost:3000)
   - Супер-админка: [http://localhost:3001/login](http://localhost:3001/login) (первый визит — bootstrap главного админа)
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
| `npm run dev` | Только панель клиентов :3000 |
| `npm run dev:api` | API :3333 (с проверкой локального Postgres) |
| `npm run dev:admin` | Супер-админка :3001 |
| `npm run dev:full` | API + оба Next-приложения |
| `npm run build` | Сборка всех workspace |
| `npm run postgres:up` / `postgres:stop` | PostgreSQL в Docker |
| `npm run docker:up` / `docker:down` | Полный compose-стек |

## ИИ и почта

В `apps/api/.env` задайте хотя бы один ключ: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` или `GEMINI_API_KEY` — для ответов ИИ на API. Для рассылок удержания — блок `SMTP_*` (см. комментарии в `apps/api/.env.example`).

На клиенте опционально: `NEXT_PUBLIC_GEMINI_API_KEY` в `apps/user-dashboard/.env.local` — запасной путь для кнопок «Доработать с ИИ», если API недоступен.
