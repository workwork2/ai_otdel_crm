# Архитектура репозитория «AI Отдел»

Продукт в интерфейсе — **AI Отдел** (CRM для клиентов, QA, автоматизации, биллинг). Репозиторий — npm-workspace монорепо: **один Next.js-приложение** (`apps/web`) и **Nest API** (`apps/api`).

## Слои

| Слой | Папка | npm-пакет (workspace `name`) | Роль |
|------|--------|------------------------------|------|
| API | `apps/api` | `tenant-api` | NestJS: tenants, auth (портал + платформа), Drizzle/PostgreSQL, ИИ, почта, QA merge с поддержкой |
| Веб | `apps/web` | `web` | Next.js :3000 — CRM по корневым маршрутам; **Control Plane** под префиксом `/platform` (вход `/platform/login`) |
| Инфра | `docker/`, `docker-compose.yml`, `scripts/` | — | Сборка, Postgres, утилиты (`reset-db`, `pg-ping`) |

Команды из корня используют **имена пакетов**: `npm run dev -w web`, `npm run dev:api` (алиас на `tenant-api`).

## Стили (`apps/web`)

- Сборка: **`src/styles/main.scss`** подключает `@use` цепочку `_tokens.scss` → `_base.scss` → `_shell.scss` → `_platform-theme.scss` → `_extras.scss`.
- Утилиты в разметке (классы в духе Tailwind): **`src/styles/static-utilities.css`** — заранее собранный слой, **Tailwind в зависимостях не используется**. После добавления новых утилитарных классов в TSX пересоберите: `npm run regen:css -w web` (исходник списка классов — `src/styles/tw-build.css`, скрипт `scripts/regen-static-css.mjs`).
- Пути для `@import`/`@use` в SASS: `sassOptions.includePaths` в `apps/web/next.config.ts`.

## Потоки данных

- **Клиент** хранит `tenantId` + JWT в `sessionStorage` (`tenant-auth.ts`), шлёт `Authorization` на API.
- **Супер-админ** хранит платформенный JWT (`platform-auth.ts`), ключ/API в заголовках (`backend-api.ts`).
- **Состояние воркспейса** tenant живёт в API (store + Postgres); фронт гидратирует и при необходимости дебаунсит `PUT` (аудитория, QA и т.д.).

## Соглашения по фронту (CRM)

- Макет страниц: классы `.crm-page`, `.crm-page--narrow|std|wide`, типографика `.crm-page-h1` / `.crm-page-lead` в `apps/web/src/styles/_shell.scss` (сборка через `main.scss`).
- Нативные `<select>` для фильтров — компонент `components/ui/NativeSelect.tsx` (единый вид и фокус).

## Соглашения по Control Plane (`/platform`)

- Тема платформы: `apps/web/src/styles/_platform-theme.scss` (префикс `sa-*`).
- Селекты: `components/platform/NativeSelect.tsx`.

## Что не коммитить

- Симлинк `src` в корне репозитория (раньше вёл на старую панель) — удалён; дублировать не нужно.
- `.claude/`, `.env`, `*.tsbuildinfo` — в `.gitignore`.

## История имён

Рабочее имя монорепо в `package.json` корня: **`ai-otdel-workspace`**. Имя папки на диске может оставаться `linearize-ai-dashboard` — это не мешает сборке.
