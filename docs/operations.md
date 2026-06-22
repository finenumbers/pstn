# Эксплуатация PSTN Analytics

Руководство администратора: первая загрузка, обновление, backup, OPR, тестирование, устранение неполадок.

---

## Публикация на GitHub

Основной репозиторий: https://github.com/finenumbers/pstn

Первый push с локальной машины (после создания пустого репозитория на GitHub):

```bash
git remote add origin https://github.com/finenumbers/pstn.git
git push -u origin main
```

Если `origin` уже настроен на другой URL:

```bash
git remote set-url origin https://github.com/finenumbers/pstn.git
git push -u origin main
```

Не используйте `git push --force` на `main`, если в удалённом репозитории уже есть коммиты.

---

## Первая загрузка данных

1. Убедитесь, что stack healthy: `curl http://127.0.0.1:5555/api/health`
2. Откройте `/ranges` (локально или через NPM)
3. Нажмите **«Загрузить данные»**
4. Дождитесь карточки «Загрузка завершена» (~5–10 мин)
5. Проверьте KPI: ~446k диапазонов

**Требования:** исходящий HTTPS до `opendata.digital.gov.ru`.

### Re-import после обновления территорий

Если после деплоя колонки «Регион» / «Территория ГАР» выглядят некорректно — выполните **«Загрузить данные»** (полный import 4 CSV). Схема хранит значения 1:1 из CSV; старые распарсенные данные не мигрируются автоматически.

### Загрузка реестра OPR (УВр Антифraud)

Реестр OPR **встроен в проект**: [`data/opr/OPR_2026_06_18_00_00_00.csv`](../data/opr/OPR_2026_06_18_00_00_00.csv) (2848 операторов). В Docker-образе путь `/app/data/opr/…`.

**После Pull and redeploy** приложение само загружает OPR при старте — колонка «УВр Антифraud» заполняется по JOIN с `number_ranges` по ИНН.

Проверка:

```bash
docker exec pstn_postgres psql -U pstn -d pstn -c "SELECT COUNT(*) FROM operators_register;"
docker logs pstn_app 2>&1 | grep "OPR operators"
```

Переопределить файл (редко): env `OPR_CSV_PATH` в stack. Ручной import:

```bash
tsx scripts/import-opr-csv.ts data/opr/OPR_2026_06_18_00_00_00.csv
```

---

## Обновление приложения

### CLI (VPS)

```bash
cd /opt/pstn
./scripts/deploy.sh
```

Переменные:

- `SKIP_GIT_PULL=1` — без `git pull`
- `COMPOSE_FILE=docker-compose.prod.yml` — default

### Portainer

Stacks → `pstn` → **Pull and redeploy** (с rebuild образа).

### Критично: rebuild vs restart

Next.js собирается в **standalone bundle** внутри образа. После изменений кода:

```bash
docker compose build app && docker compose up -d app
```

`docker compose restart app` **не** подхватит новый код.

Принудительная пересборка без кэша:

```bash
docker compose build --no-cache app && docker compose up -d app
```

---

## Backup PostgreSQL

```bash
./scripts/backup-db.sh
```

Параметры:

- `COMPOSE_FILE` — default `docker-compose.prod.yml`
- `BACKUP_DIR` — default `/var/backups/pstn`

Выход: `pstn_YYYYMMDD_HHMMSS.sql.gz`

Восстановление (пример):

```bash
gunzip -c /var/backups/pstn/pstn_20260622_120000.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U pstn -d pstn
```

Проект **не** включает автоматический backup — настройте cron или внешний инструмент.

---

## Восстановление данных

Автоимпортов и point-in-time recovery в проекте нет.

| Ситуация | Действие |
|----------|----------|
| KPI неверные / данные повреждены | `/ranges` → **«Загрузить данные»** (full reload) |
| Потеря volume `pstn_pg_data` | Восстановить backup + при необходимости re-import |
| Import failed mid-way | Production не изменён; повторите import |

---

## Миграции БД

При старте контейнера entrypoint применяет SQL из `packages/db/migrations/*.sql`.

Локально:

```bash
npm run db:migrate
# или
npx tsx scripts/migrate.ts
```

Таблица `schema_migrations` отслеживает применённые файлы.

---

## Мониторинг

| Check | Команда | Где использовать |
|-------|---------|------------------|
| App + DB | `curl -sf http://127.0.0.1:5555/api/health` | Локально на VPS |
| Containers | `docker compose ps` | VPS / Portainer |
| App logs | `docker compose logs -f app` | VPS |
| Import status | UI progress card или `GET /api/import/status?jobId=` | При import |

**Не рекомендуется** expose `/api/health` публично без rate limit.

---

## Разработка и тесты

### Локальный dev

```bash
cp .env.example .env
npm run docker:dev-db
npm install
npm run db:migrate
npm run dev
```

### Тесты

```bash
npm run docker:dev-db
npm run db:migrate
npm test
npm run test:e2e
npm run lint
npm run audit
```

DB-тесты (`tests/db/*`) создают и удаляют минимальные строки — **не** используйте production DATABASE_URL для тестов.

### Пересборка справочников

```bash
npm run db:rebuild-dicts
```

---

## Troubleshooting

### `curl /api/health` → 503, database down

- Проверьте `pstn_postgres`: `docker compose ps`
- Логи postgres: `docker compose logs postgres`
- `DATABASE_URL`: хост `postgres` в Docker, не `localhost`

### Import failed

- Проверьте исходящий доступ к opendata.digital.gov.ru
- Логи app: `docker compose logs app | tail -100`
- Типичные причины: timeout download, incomplete CSV, validation failed
- Production data **не** изменены — безопасно повторить

### Пустая таблица после deploy

Нормально до первого import. Нажмите **«Загрузить данные»**.

### NPM → 502 Bad Gateway

Пошаговый разбор и таблица сценариев: **[docs/npm.md](npm.md)**.

Кратко: NPM в Docker → Forward **`pstn_app:5555`**, не `127.0.0.1`. NPM на хосте → Forward **`127.0.0.1:5555`**. Stack `pstn` — **Pull and redeploy** (сеть `proxy`).

### UI import не работает при `IMPORT_SECRET`

UI не отправляет `X-Import-Secret`. Варианты:

- Уберите `IMPORT_SECRET`, полагайтесь на NPM Access List
- Или вызывайте import через curl с заголовком

### External lookup 401

- Проверьте ключ: `docker compose exec app cat /app/.secrets/external_api_key`
- Header: `Authorization: Bearer <key>` или `X-Api-Key`

### Export EXPORT_TOO_LARGE

Сузьте фильтры — лимит **500 000** строк.

### Export медленный

> 100k строк — ожидайте несколько минут. UI показывает confirm.

### Portainer: прочерк в «Images up to date»

Как у `geoip`: stack должен быть создан **через Portainer → Git repository** (**Control: Total**), compose path `docker-compose.portainer.yml`, образ `ghcr.io/finenumbers/pstn:latest` без `build:`.

Если **Control = Limited** (stack поднимали через SSH) — пересоздайте stack через Portainer, см. [deployment.md](deployment.md#stack-limited-created-outside-of-portainer).

```bash
docker inspect pstn_app --format '{{.Config.Image}}'
# ghcr.io/finenumbers/pstn:latest
```

Registries в Portainer **не нужны** (публичный GHCR).

### Portainer: `ERR_INVALID_URL` / `Invalid URL` / `base: 'postgres://base'`

**Причина:** неверный `DATABASE_URL` в переменных stack — частые случаи:

- пароль в URL не совпадает с `POSTGRES_PASSWORD`;
- в пароле символы `@`, `:`, `/`, `#` без URL-кодирования (`@` → `%40`);
- в значении оставлен placeholder `<password>` или литерал `${POSTGRES_PASSWORD}` (Portainer **не** подставляет переменные внутри другой переменной);
- лишние кавычки вокруг значения.

**Решение (актуальный compose):** достаточно **`POSTGRES_PASSWORD`** — `DATABASE_URL` собирается в контейнере автоматически. Удалите `DATABASE_URL` из переменных stack и redeploy с новым образом.

**Быстрый fix без обновления образа:** задайте URL вручную, пароль URL-encoded, хост **`postgres`**:

```
DATABASE_URL=postgresql://pstn:ВАШ_ПАРОЛЬ_URL_ENCODED@postgres:5432/pstn
```

### Portainer: `504 Gateway Time-out` (openresty)

**Причина:** UI Portainer открыт через NGINX Proxy Manager. Кнопка **Deploy the stack** ждёт завершения операции Docker; при **сборке образа** на сервере это 5–15 минут, NPM по умолчанию обрывает запрос через ~60 с.

**Что делать:**

1. Обновите stack compose до актуального `docker-compose.portainer.yml` — образ `ghcr.io/finenumbers/pstn:latest`, без `build:`.
2. Убедитесь, что stack с **Control: Total** (создан через Portainer Git, не через SSH).
3. **Pull and redeploy**.

### Portainer: `open Dockerfile: no such file or directory`

Устаревший compose с `build.context: .` или локальной сборкой. Используйте актуальный `docker-compose.portainer.yml` — образ `ghcr.io/finenumbers/pstn`, без сборки на сервере.

### Изменения кода не видны после restart

Нужен `docker compose build app`, не restart.

### IDE: «Npm task detection: failed to parse package.json»

Cursor/VS Code не смог прочитать `package.json`. Проверьте синтаксис, **Developer: Reload Window**.

---

## Полезные команды

```bash
npm run docker:logs
npm run docker:prod:logs
npm run docker:down

docker compose exec app cat /app/.secrets/external_api_key

curl "http://127.0.0.1:5555/api/import/status?jobId=<uuid>"

tsx scripts/import-opr-csv.ts ./opr.csv
```

---

## Связанные документы

- [deployment.md](deployment.md) — деплой, Portainer
- [npm.md](npm.md) — NGINX Proxy Manager
- [security.md](security.md) — секреты и auth
- [user-guide.md](user-guide.md) — UI
- [api-reference.md](api-reference.md) — HTTP API
