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

Реестр OPR (колонка «УВр Антифрод») встроен в Docker-образ и загружается автоматически при старте — см. [troubleshooting](#реестр-opr-увр-антифрод).

---

## Автоимпорт (cron)

При деплое с [`docker-compose.prod.yml`](../docker-compose.prod.yml) или Portainer stack поднимается контейнер **`pstn_scheduler`**. Он ежедневно в **18:00 Europe/Moscow** вызывает `POST /api/import` с `triggeredBy=cron`.

> **Локальная разработка** (`docker-compose.yml`, `docker-compose.dev.yml`) **не включает** scheduler — import только вручную.

### Поведение

1. **SHA256** четырёх CSV сравнивается с `dataset_meta.source_hashes`.
2. Если файлы **не изменились** — job получает статус `skipped`, production не трогается.
3. Если **изменились** — полный pipeline: staging → validate → diff → swap → snapshot (если есть сегменты) → OPR/UVR.
4. При наличии расхождений создаётся snapshot **«Расхождения DD.MM.YYYY»** (таблицы `dataset_snapshots`, `number_range_diffs`).

### Scheduler container

- Образ: `alpine:3.21` + `curl` + `crond`
- Скрипт: `/usr/local/bin/pstn-cron-import.sh`
- Лог успеха/ошибки: `[pstn-cron] HTTP <code> <json body>`
- Non-2xx HTTP → exit code 1 (crond зафиксирует ошибку)

### Требования

- `IMPORT_SECRET` задан в env **app** и **scheduler** (compose validation)
- Исходящий HTTPS до `opendata.digital.gov.ru`

### Проверка

```bash
docker compose -f docker-compose.prod.yml logs scheduler --tail 50
docker compose -f docker-compose.prod.yml exec postgres psql -U pstn -d pstn -c \
  "SELECT status, skip_reason, triggered_by, progress_phase, finished_at FROM import_jobs ORDER BY created_at DESC LIMIT 5;"
```

Ожидаемый лог scheduler при успехе:

```
[pstn-cron] HTTP 200 {"jobId":"...","status":"pending"}
```

или при skip (после завершения job):

```
[pstn-cron] HTTP 200 {"jobId":"...","status":"skipped"}
```

Подробнее: [import-and-datasets.md](import-and-datasets.md).

---

## Diff snapshots: эксплуатация

### Что хранится

| Таблица | Содержание |
|---------|------------|
| `dataset_snapshots` | Метаданные: MSK `load_date`, counts added/changed/removed |
| `number_range_diffs` | Строки расхождений с `change_type` и optional `prev_*` |

Snapshot создаётся **только если** diff algorithm нашёл сегменты. Повторный import с diff в тот же MSK-день перезаписывает snapshot (UNIQUE на `load_date`).

### Retention

**Автоматического удаления** старых snapshots нет. Backup PostgreSQL (`./scripts/backup-db.sh`) включает snapshots.

### Audit SQL

```sql
-- Список snapshots
SELECT id, load_date, added_count, changed_count, removed_count, created_at
FROM dataset_snapshots ORDER BY load_date DESC;

-- Diff по типам
SELECT s.load_date, d.change_type, COUNT(*)
FROM dataset_snapshots s
JOIN number_range_diffs d ON d.snapshot_id = s.id
GROUP BY s.load_date, d.change_type
ORDER BY s.load_date DESC, d.change_type;
```

### API для UI

`GET /api/datasets` — список для селектора. UUID из `items[].id` (kind=diff) передаётся в query как `dataset=diff:<uuid>`.

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

Stacks → `pstn` → **Pull and redeploy** — подтягивает новый образ `ghcr.io/finenumbers/pstn:latest` с GHCR (сборка на сервере не выполняется).

После push в `main` дождитесь успешного CI и workflow **Publish Docker image**, затем redeploy.

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

**Point-in-time recovery (PITR) и восстановление «на момент вчерашнего cron» в проекте не реализованы.** Cron-импорт обновляет production in-place; diff snapshots — это журнал расхождений, а не полный backup.

| Ситуация | Действие |
|----------|----------|
| KPI неверные / данные повреждены | `/ranges` → **«Загрузить данные»** (full reload) или curl с `X-Import-Secret` |
| Потеря volume `pstn_pg_data` | Восстановить backup + при необходимости re-import |
| Import failed mid-way (до swap) | Production не изменён; повторите import |
| Нужна история «что изменилось» | Селектор «Расхождения DD.MM.YYYY» или `GET /api/ranges?dataset=diff:<uuid>` |

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
| **Scheduler logs** | `docker compose logs scheduler --tail 50` | Проверка cron; ищите `[pstn-cron] HTTP` |
| Import status | UI progress card или `GET /api/import/status?jobId=` | При import |
| Datasets list | `curl -s http://127.0.0.1:5555/api/datasets` | Проверка snapshots после import |
| Import jobs SQL | `SELECT status, skip_reason, triggered_by FROM import_jobs ORDER BY created_at DESC LIMIT 5` | Audit |

**Рекомендация:** настройте алерт, если scheduler log содержит `HTTP 401`, `HTTP 5xx` или отсутствует успешный cron-запуск более 25 часов.

**Не рекомендуется** expose `/api/health` публично без rate limit. В production ответ минимальный (`status`, `database`); подробности — только при `HEALTH_VERBOSE=1` или в dev.

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

### Реестр OPR (УВр Антифрод)

По умолчанию реестр **встроен в образ** ([`data/opr/OPR_2026_06_18_00_00_00.csv`](../data/opr/OPR_2026_06_18_00_00_00.csv)) и загружается при старте и после import CSV Минцифры. Колонка «УВр Антифрод» заполняется JOIN по ИНН.

Проверка:

```bash
docker exec pstn_postgres psql -U pstn -d pstn -c "SELECT COUNT(*) FROM operators_register;"
docker logs pstn_app 2>&1 | grep "OPR operators"
```

**Переопределение (редко):** в Portainer `OPR_CSV_PATH` **не проброшен** в [`docker-compose.portainer.yml`](../docker-compose.portainer.yml) — потребуется правка compose или ручной import:

```bash
tsx scripts/import-opr-csv.ts data/opr/OPR_2026_06_18_00_00_00.csv
```

### UI import не работает при `IMPORT_SECRET`

Production stack с scheduler **всегда** задаёт `IMPORT_SECRET` на app и scheduler. UI **не отправляет** заголовок `X-Import-Secret` → кнопка «Загрузить данные» возвращает **401**.

**Workarounds:**

1. **Manual import через curl** (рекомендуется):

```bash
curl -X POST "https://pstn.example.com/api/import" \
  -H "X-Import-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json"
```

2. **NPM inject header** — добавить `X-Import-Secret` на POST `/api/import` для доверенных IP (осторожно с rate limit и ACL).

3. **Убрать `IMPORT_SECRET` только на app** — cron продолжит работать (secret в scheduler env), manual UI заработает, но app не проверяет secret для POST import. Менее строго.

Подробнее: [import-and-datasets.md](import-and-datasets.md), [security.md](security.md).

### External lookup 401

- Проверьте ключ: диалог **API** на `/ranges` (готовые curl) или `docker compose exec app cat /app/.secrets/external_api_key`
- Header: `Authorization: Bearer <key>` или `X-Api-Key`

### Export EXPORT_TOO_LARGE

Сузьте фильтры — лимит **500 000** строк.

### Export медленный

> 100k строк — ожидайте несколько минут. UI показывает confirm.

### Portainer: зелёная галочка, но код старый

**Зелёный статус stack** = контейнеры running/healthy. Это **не** «образ с GHCR обновлён».

**Решение:** Stacks → `pstn` → **Pull and redeploy** (compose с `pull_policy: always`). Проверка: `HEALTH_VERBOSE=1` + `curl /api/health` на app, тег GHCR или GitHub Release. Если версия не меняется — stack **Control: Limited** или старый compose без `pull_policy`; см. [deployment.md](deployment.md#stack-limited-created-outside-of-portainer).

### Portainer: прочерк в «Images up to date»

Как у `geoip`: stack через **Portainer → Git repository** (**Control: Total**), compose path `docker-compose.portainer.yml`, образ `ghcr.io/finenumbers/pstn:latest` без `build:`.

Если **Control = Limited** (stack поднимали через SSH) — индикатор устаревшего образа **не работает**, Pull and redeploy может не подтягивать GHCR. Пересоздайте stack через Portainer, см. [deployment.md](deployment.md#stack-limited-created-outside-of-portainer).

**Проверка версии на сервере:**

UI `/ranges` **не показывает** номер версии. Варианты:

1. **`HEALTH_VERBOSE=1`** в env контейнера app (Portainer → stack → Environment variables → redeploy):

```bash
curl -s http://127.0.0.1:5555/api/health | jq .
# version должна совпадать с последним GitHub release
```

2. Тег образа: `docker inspect pstn_app --format '{{.Config.Image}}'` и digest после `docker pull ghcr.io/finenumbers/pstn:latest`.

3. Логи контейнера при старте: строка `[pstn] APP_VERSION=... APP_REVISION=...`.

В **dev** (`npm run dev`) или без `NODE_ENV=production` health возвращает verbose-поля и без `HEALTH_VERBOSE`.

**Принудительный pull вручную** (если redeploy не обновил образ):

```bash
docker pull ghcr.io/finenumbers/pstn:latest
docker compose -f docker-compose.portainer.yml up -d --force-recreate app
```

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

Portainer: **Pull and redeploy** (новый образ с GHCR). CLI: `docker compose build app`, не restart.

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

- [import-and-datasets.md](import-and-datasets.md) — импорт, cron, diff snapshots (опорный документ)
- [deployment.md](deployment.md) — деплой, Portainer
- [npm.md](npm.md) — NGINX Proxy Manager
- [security.md](security.md) — секреты и auth
- [user-guide.md](user-guide.md) — UI
- [api-reference.md](api-reference.md) — HTTP API
