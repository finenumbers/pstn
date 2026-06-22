# PSTN Analytics

Веб-сервис аналитики телефонной нумерации Минцифры России.

## Стек

- Next.js 15, React 19, TypeScript
- TanStack Table + TanStack Query
- shadcn/ui + Tailwind CSS 4
- PostgreSQL 16 + Drizzle ORM

## Запуск через Docker Desktop (production)

Полный стек: PostgreSQL + Next.js в контейнерах.

```bash
docker compose up -d --build
```

Откройте http://localhost:5555/ranges и нажмите **Загрузить данные** для полной перезагрузки CSV с opendata.digital.gov.ru.

Полезные команды:

```bash
npm run docker:up      # build + start
npm run docker:down    # остановить контейнеры
npm run docker:logs    # логи приложения
docker compose ps      # статус сервисов
```

При первом запуске контейнер `app` автоматически применяет миграции и стартует сервер.

## Production (VPS)

Рекомендуемые ресурсы: **4 GB RAM**, **20–50 GB** диск, Ubuntu 22.04/24.04 или Debian 12.

Stack содержит **только проект**: PostgreSQL + приложение. NGINX Proxy Manager, Portainer и SSL **не входят** в compose — ставятся и настраиваются отдельно.

**Импорт данных — только вручную:** `/ranges` → **«Загрузить данные»**. Автоимпортов и расписаний нет.

### Compose-файлы

| Файл | Назначение |
|------|------------|
| `docker-compose.portainer.yml` | Деплой через **Portainer** (env в UI) |
| `docker-compose.prod.yml` | Деплой через **CLI** (файл `.env`) |

Приложение слушает **`127.0.0.1:5555`** на хосте. PostgreSQL снаружи недоступен.

Переменные: `portainer.env.example` (Portainer) или `.env.production.example` → `.env` (CLI).

### 1. Деплой через Portainer

1. Portainer → **Stacks** → **Add stack**
2. **Git:** URL репозитория, Compose path: `docker-compose.portainer.yml`  
   или **Web editor:** вставьте содержимое файла
3. **Environment variables** — из `portainer.env.example`:
   - `POSTGRES_PASSWORD` — сильный пароль
   - `DATABASE_URL` — тот же пароль, хост **`postgres`**
4. **Deploy the stack** → дождитесь **healthy** у `pstn_app` (~2–3 мин при первой сборке)

### 2. Деплой через CLI

```bash
git clone <repo-url> /opt/pstn
cd /opt/pstn
cp .env.production.example .env
# отредактируйте пароли в .env

docker compose -f docker-compose.prod.yml up -d --build
# или
./scripts/deploy.sh
```

Проверка: `curl http://127.0.0.1:5555/api/health`

### 3. Первая загрузка данных

1. Откройте `http://127.0.0.1:5555/ranges` (или домен после настройки NPM)
2. **«Загрузить данные»** — все 4 CSV с opendata.digital.gov.ru (~5–10 мин, ~446k строк)
3. Нужен исходящий HTTPS с VPS до opendata.digital.gov.ru

### 4. NGINX Proxy Manager (отдельно, не в compose)

NPM ставится и обновляется **независимо** от этого проекта.

#### Вариант A — NPM проксирует на localhost

Stack публикует app на `127.0.0.1:5555`. В NPM → **Proxy Hosts** → **Add**:

| Поле | Значение |
|------|----------|
| Domain Names | `pstn.example.com` |
| Forward Hostname / IP | `127.0.0.1` |
| Forward Port | `5555` |
| SSL | Request a new SSL Certificate (Let's Encrypt) |

#### Вариант B — NPM в Docker (Portainer)

1. NPM работает в **отдельном** stack (своя docker-сеть, например `npm_default`)
2. Portainer → **Containers** → `pstn_app` → **Join network** → сеть NPM
3. В NPM → **Proxy Host**:

| Поле | Значение |
|------|----------|
| Domain Names | `pstn.example.com` |
| Forward Hostname / IP | `pstn_app` |
| Forward Port | `5555` |
| SSL | Let's Encrypt |

Сеть NPM подключается через **Join network** в Portainer — compose проекта менять не нужно.

#### Рекомендации по NPM

- **Access List** или Basic Auth — в приложении нет встроенного логина
- Health check (опционально): `GET /api/health` → `200`, `"status":"ok"`
- `IMPORT_SECRET` **не задавайте**, если импорт через кнопку в UI

### 5. Обновление

**Portainer:** Stacks → `pstn` → Pull and redeploy.

**CLI:** `cd /opt/pstn && ./scripts/deploy.sh`

### 6. Бэкап PostgreSQL

```bash
COMPOSE_FILE=docker-compose.portainer.yml ./scripts/backup-db.sh
```

Cron **только для бэкапа**, не для импорта:

```cron
0 3 * * * cd /opt/pstn && COMPOSE_FILE=docker-compose.portainer.yml ./scripts/backup-db.sh
```

### 7. Мониторинг

`GET /api/health` — Uptime Kuma, NPM health checks, `curl` на VPS.

## Локальная разработка

Только PostgreSQL в Docker, Next.js на хосте:

```bash
cp .env.example .env
npm run docker:dev-db
npm install
npm run db:migrate
npm run dev
```

## API

- `GET /api/health` — healthcheck приложения и PostgreSQL
- `GET /api/ranges` — таблица с пагинацией, фильтрами, сортировкой
- `GET /api/ranges/facets` — фасетные опции для select-фильтров
- `GET /api/summary` — KPI агрегаты
- `POST /api/import` — полная перезагрузка **всех четырёх** CSV с opendata.digital.gov.ru без ограничений по объёму; неполный импорт отклоняется до подмены production-данных
- `GET /api/import/status` — статус импорта
- `GET /api/export/ranges` — экспорт XLSX с текущими фильтрами

## Тесты

```bash
npm run docker:dev-db   # PostgreSQL для локальных DB-тестов
npm run db:migrate
npm run db:seed-test    # минимальный набор строк для tests/db/*
npm test
npm run lint
```

DB-интеграционные тесты (`tests/db/*`) выполняются только при заданном `DATABASE_URL`. В CI фикстура загружается автоматически после миграций.

## Устранение неполадок IDE

**`Npm task detection: failed to parse package.json`** — Cursor/VS Code не смог прочитать `package.json` как JSON (обычно несохранённый буфер или синтаксическая ошибка). Проверьте файл и выполните **Developer: Reload Window**. Если `package.json` валиден (`npm pkg get name` работает), ошибка исчезнет после перезагрузки.
