# Деплой PSTN Analytics

Руководство по развёртыванию приложения во всех поддерживаемых сценариях: локальная разработка, Docker Desktop, production на VPS через CLI или Portainer, интеграция с NGINX Proxy Manager.

Разработано оператором телефонной связи для бизнеса [Finenumbers](https://finenumbers.com).  
По всем вопросам: [apps@finenumbers.com](mailto:apps@finenumbers.com)

**Репозиторий:** https://github.com/finenumbers/pstn

---

## Требования

### Production (VPS)

| Параметр | Рекомендация |
|----------|--------------|
| RAM | 4 GB |
| Диск | 20–50 GB (данные ~446k диапазонов + индексы) |
| ОС | Ubuntu 22.04/24.04, Debian 12 |
| Сеть | Исходящий HTTPS до `opendata.digital.gov.ru` (импорт CSV) |
| Docker | Docker Engine + Compose v2 |

### Локальная разработка

- Node.js 20
- Docker Desktop (для PostgreSQL)
- npm

---

## Обзор compose-файлов

| Файл | Сервисы | Публикация портов | Env |
|------|---------|-------------------|-----|
| `docker-compose.dev.yml` | postgres | `5432:5432` | встроенные dev-пароли |
| `docker-compose.yml` | postgres + app | app `127.0.0.1:5555`, pg `127.0.0.1:5432` | встроенные dev-пароли |
| `docker-compose.prod.yml` | postgres + app | app `127.0.0.1:5555` | `.env` |
| `docker-compose.portainer.yml` | postgres + app | app `127.0.0.1:5555` | переменные в UI Portainer |

PostgreSQL в production **не** публикуется на хост — доступен только внутри docker-сети (`postgres:5432`).

---

## Жизненный цикл контейнера app

Entrypoint [`scripts/docker-entrypoint.sh`](../scripts/docker-entrypoint.sh) выполняет:

1. **Ожидание PostgreSQL** — `pg_isready` к хосту `DB_HOST` (по умолчанию `postgres`).
2. **Миграции** — последовательное применение SQL из `packages/db/migrations/*.sql` с учётом таблицы `schema_migrations`.
3. **External API key** — чтение или генерация `EXTERNAL_API_KEY` в volume `/app/.secrets/external_api_key`.
4. **Старт сервера** — `node server.js` (Next.js standalone) от пользователя `nextjs`.

Образ собирается multi-stage [`Dockerfile`](../Dockerfile): `npm ci` → `npm run build` → standalone bundle + миграции + entrypoint.

### Healthcheck (production compose)

Контейнер `pstn_app` в `docker-compose.prod.yml` и `docker-compose.portainer.yml`:

- Endpoint: `GET /api/health`
- Interval: 30s, timeout: 10s, retries: 5
- `start_period`: 120s (первая сборка может занять 2–3 минуты)

Проверка вручную:

```bash
curl -sf http://127.0.0.1:5555/api/health
# {"status":"ok","database":"ok"}
```

---

## Сценарий 1: Локальная разработка

Next.js на хосте, PostgreSQL в Docker.

```bash
cp .env.example .env
npm run docker:dev-db          # docker-compose.dev.yml
npm install
npm run db:migrate             # или npx tsx scripts/migrate.ts
npm run dev                    # http://localhost:5555
```

Переменная `DATABASE_URL` должна указывать на `localhost:5432`. Для external lookup API в dev можно задать `EXTERNAL_API_KEY=dev-local-key` в `.env`.

Остановка БД:

```bash
docker compose -f docker-compose.dev.yml down
```

---

## Сценарий 2: Docker Desktop (полный стек)

PostgreSQL и приложение в контейнерах, dev-пароли `pstn/pstn`.

```bash
docker compose up -d --build
# или
npm run docker:up
```

- UI: http://localhost:5555/ranges
- Первая загрузка: кнопка **«Загрузить данные»** (~5–10 мин, ~446k строк)

Полезные команды:

```bash
npm run docker:logs
npm run docker:down
docker compose ps
```

---

## Сценарий 3: Production через CLI

### Подготовка

```bash
git clone https://github.com/finenumbers/pstn.git /opt/pstn
cd /opt/pstn
cp .env.production.example .env
```

Отредактируйте `.env`:

- `POSTGRES_PASSWORD` — сильный пароль (`openssl rand -base64 32`)
- `DATABASE_URL` — тот же пароль, хост **`postgres`** (не `localhost`)

### Запуск и обновление

```bash
./scripts/deploy.sh
# или вручную:
docker compose -f docker-compose.prod.yml up -d --build
```

Скрипт [`scripts/deploy.sh`](../scripts/deploy.sh):

- Проверяет наличие `.env`
- Выполняет `git pull` (если не задан `SKIP_GIT_PULL=1`)
- `docker compose -f docker-compose.prod.yml up -d --build`

**Важно:** после изменений в коде нужен **`docker compose build app`**, а не только `restart` — Next.js standalone bundle в образе не обновляется при простом перезапуске.

### Backup БД

```bash
./scripts/backup-db.sh
# по умолчанию: /var/backups/pstn/pstn_YYYYMMDD_HHMMSS.sql.gz
```

---

## Сценарий 4: Production через Portainer

### Шаг 1 — Stack

1. Portainer → **Stacks** → **Add stack**
2. Источник:
   - **Git repository:** `https://github.com/finenumbers/pstn`, Compose path: `docker-compose.portainer.yml`
   - или **Web editor:** вставьте содержимое `docker-compose.portainer.yml`
3. **Environment variables** — из [`portainer.env.example`](../portainer.env.example):

| Переменная | Пример | Обязательна |
|------------|--------|-------------|
| `POSTGRES_PASSWORD` | `<openssl rand -base64 32>` | да |
| `DATABASE_URL` | `postgresql://pstn:<password>@postgres:5432/pstn` | да |
| `POSTGRES_USER` | `pstn` | нет (default) |
| `POSTGRES_DB` | `pstn` | нет (default) |
| `APP_PORT` | `5555` | нет |
| `LOG_LEVEL` | `info` | нет |
| `DB_POOL_MAX` | `10` | нет |
| `DB_IMPORT_POOL_MAX` | `4` | нет |
| `IMAGE_TAG` | `latest` | нет |
| `EXTERNAL_API_BASE_URL` | `https://pstn.example.com` | рекомендуется |
| `EXTERNAL_API_KEY` | фиксированный ключ | нет (auto) |
| `IMPORT_SECRET` | секрет import API | нет |

4. **Deploy the stack**
5. Дождитесь статуса **healthy** у контейнера `pstn_app` (~2–3 мин при первой сборке)

### Шаг 2 — Проверка

```bash
curl http://127.0.0.1:5555/api/health
```

### Шаг 3 — Обновление

Portainer → Stacks → `pstn` → **Pull and redeploy** (или **Update the stack** с rebuild).

---

## NGINX Proxy Manager

NPM устанавливается и обновляется **независимо** от compose проекта PSTN.

### Вариант A — NPM на хосте, app на localhost

Stack публикует app на `127.0.0.1:5555`. В NPM → **Proxy Hosts** → **Add**:

| Поле | Значение |
|------|----------|
| Domain Names | `pstn.example.com` |
| Scheme | `http` |
| Forward Hostname / IP | `127.0.0.1` |
| Forward Port | `5555` |
| Block Common Exploits | включить |
| Websockets Support | выключить (не требуется) |
| SSL | Request a new SSL Certificate (Let's Encrypt) |

### Вариант B — NPM и app оба в Docker

1. NPM работает в отдельном stack (сеть, например `npm_default`).
2. Portainer → **Containers** → `pstn_app` → **Join network** → сеть NPM.
3. В NPM → **Proxy Host**:

| Поле | Значение |
|------|----------|
| Forward Hostname / IP | `pstn_app` |
| Forward Port | `5555` |

Compose PSTN менять не нужно.

### Доступ и SSL

- **Access List** или **Basic Auth** в NPM — основная защита UI и internal API.
- В приложении нет встроенной авторизации.
- `/api/health` — для локальной проверки после деплоя; не выставляйте наружу без ограничений.

### Rate limiting (рекомендуется)

Приложение не имеет встроенного rate limit. Ограничивайте на прокси:

| Location | Рекомендуемый лимит | Назначение |
|----------|---------------------|------------|
| `/api/export/ranges` | 5 req/min на IP | Тяжёлый XLSX export |
| `/api/v1/lookup/search` | 60 req/min на IP | Поиск по маске |
| `/api/v1/lookup` | 120 req/min на IP | Точный lookup |
| `/api/import` | 1 req/10 min на IP | Защита от повторного full reload |

#### Пример Custom Nginx Configuration (NPM → Advanced)

```nginx
# Zone definitions — добавьте в http-контекст NPM или через custom snippet
limit_req_zone $binary_remote_addr zone=pstn_export:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=pstn_lookup:10m rate=120r/m;
limit_req_zone $binary_remote_addr zone=pstn_search:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=pstn_import:10m rate=6r/h;

location /api/export/ranges {
    limit_req zone=pstn_export burst=2 nodelay;
    proxy_pass http://127.0.0.1:5555;
}

location /api/v1/lookup/search {
    limit_req zone=pstn_search burst=10 nodelay;
    proxy_pass http://127.0.0.1:5555;
}

location /api/v1/lookup {
    limit_req zone=pstn_lookup burst=20 nodelay;
    proxy_pass http://127.0.0.1:5555;
}

location /api/import {
    limit_req zone=pstn_import burst=1 nodelay;
    proxy_pass http://127.0.0.1:5555;
}
```

Точный синтаксис зависит от версии NPM; при наличии встроенного **Rate Limiting** в UI — используйте его.

---

## Переменные окружения

Полная таблица (prod / Portainer / dev):

| Переменная | Обязательна (prod) | Default | Назначение |
|------------|-------------------|---------|------------|
| `POSTGRES_USER` | нет | `pstn` | Пользователь PostgreSQL |
| `POSTGRES_PASSWORD` | **да** | — | Пароль PostgreSQL |
| `POSTGRES_DB` | нет | `pstn` | Имя базы |
| `DATABASE_URL` | **да** | — | Connection string; хост `postgres` в Docker |
| `APP_PORT` | нет | `5555` | Порт приложения |
| `PORT` | в контейнере | `5555` | То же (передаётся в Next.js) |
| `DB_HOST` | в контейнере | `postgres` | Хост PG для entrypoint |
| `DB_USER`, `DB_PASS`, `DB_NAME` | в контейнере | из POSTGRES_* | Для entrypoint/psql |
| `LOG_LEVEL` | нет | `info` | Уровень логирования |
| `DB_POOL_MAX` | нет | `10` | Max connections API pool |
| `DB_IMPORT_POOL_MAX` | нет | `4` | Max connections import pool |
| `EXTERNAL_API_KEY` | нет | auto | Ключ external lookup API |
| `EXTERNAL_API_BASE_URL` | рекомендуется | — | Публичный URL для curl-примеров в UI |
| `IMPORT_SECRET` | нет | — | Заголовок `X-Import-Secret` для import API |
| `IMAGE_TAG` | Portainer | `latest` | Тег образа `pstn-app` |
| `NODE_ENV` | в образе | `production` | Режим Next.js |

### Пул соединений PostgreSQL

[`packages/db/index.ts`](../packages/db/index.ts):

- API pool: `DB_POOL_MAX` (default 10)
- Import pool: `DB_IMPORT_POOL_MAX` (default 4)
- `connectionTimeoutMillis`: 10s
- `idleTimeoutMillis`: 30s

### External API key

При первом старте контейнера, если `EXTERNAL_API_KEY` не задан:

1. Ключ генерируется (`crypto.randomBytes(32).toString('base64')`).
2. Сохраняется в volume `pstn_secrets` → `/app/.secrets/external_api_key`.
3. В лог пишется **путь к файлу**, не значение ключа.

Получить ключ:

```bash
docker compose exec app cat /app/.secrets/external_api_key
```

Для production рекомендуется задать фиксированный `EXTERNAL_API_KEY` в env.

---

## Первая загрузка данных

1. Откройте `/ranges` (локально или через домен NPM).
2. Нажмите **«Загрузить данные»**.
3. Дождитесь завершения (~5–10 мин, все 4 CSV, ~446k строк).
4. KPI и таблица заполнятся.

Требуется исходящий HTTPS с сервера до:

- `https://opendata.digital.gov.ru/downloads/ABC-3xx.csv`
- `https://opendata.digital.gov.ru/downloads/ABC-4xx.csv`
- `https://opendata.digital.gov.ru/downloads/ABC-8xx.csv`
- `https://opendata.digital.gov.ru/downloads/DEF-9xx.csv`

User-Agent: `Mozilla/5.0 (compatible; PSTN-Analytics/1.0; +https://github.com/finenumbers/pstn)`.

### Реестр OPR (УВр Антифрод)

Колонка «УВр Антифрод» требует отдельной загрузки CSV реестра OPR — см. [operations.md](operations.md).

---

## Volumes

| Volume | Содержимое |
|--------|------------|
| `pstn_pg_data` | Данные PostgreSQL |
| `pstn_secrets` | `/app/.secrets/external_api_key` |

При удалении volume `pstn_pg_data` потребуется повторный импорт данных.

---

## Связанные документы

- [security.md](security.md) — модель безопасности и секреты
- [operations.md](operations.md) — backup, troubleshooting, OPR import
- [user-guide.md](user-guide.md) — использование UI
- [api-reference.md](api-reference.md) — HTTP API
