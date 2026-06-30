# HTTP API Reference

Справочник REST API PSTN Analytics. Базовый URL: `http://127.0.0.1:5555` (локально) или публичный домен за NPM.

**Internal API** (ranges, import, export, datasets, health) с v0.3.19+ возвращает **русскоязычные** сообщения в поле `error.message`. **External lookup API** (`/api/v1/lookup*`) сохраняет **англоязычные** сообщения для программных клиентов.

---

## Аутентификация

| Класс endpoints | Auth в приложении | Рекомендация |
|-----------------|-------------------|--------------|
| Internal (ranges, summary, export, import, examples, config, health, storage, datasets) | **Нет** | NPM Access List |
| External lookup (`/api/v1/lookup`, `/api/v1/lookup/search`) | Bearer или `X-Api-Key` | Ключ + rate limit |

### External lookup headers

```http
Authorization: Bearer <EXTERNAL_API_KEY>
```

или

```http
X-Api-Key: <EXTERNAL_API_KEY>
```

### Import (опционально)

```http
X-Import-Secret: <IMPORT_SECRET>
```

Только если `IMPORT_SECRET` задан в env.

---

## Rate limiting (in-app)

С v0.3.19 middleware ограничивает частоту запросов **per IP per process** (in-memory). Дополнение к NPM, не замена.

| Endpoint | Лимит по умолчанию | Env override |
|----------|-------------------|--------------|
| `POST /api/import` | 3 req / 10 min | `RATE_LIMIT_IMPORT=3/600000` |
| `GET /api/export/ranges` | 10 req / min | `RATE_LIMIT_EXPORT=10/60000` |
| `GET /api/ranges/facets` | 60 req / min | `RATE_LIMIT_FACETS=60/60000` |
| `/api/v1/lookup*` | 120 req / min | `RATE_LIMIT_LOOKUP=120/60000` |

Формат env: `maxRequests/windowMs`.

**Response 429:**

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
Content-Type: application/json
```

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Слишком много запросов. Повторите через 42 сек.",
    "details": { "retryAfterSec": 42 }
  }
}
```

Клиент UI читает `Retry-After` и показывает то же сообщение пользователю.

Подробнее: [security.md](security.md#in-app-rate-limiting).

---

## Формат ошибок

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

### Internal API — коды и сообщения (русский)

| Code | HTTP | message (типичный) |
|------|------|-------------------|
| `VALIDATION_ERROR` | 400 | «Некорректные параметры фильтра или сортировки.» (+ `details.issues` от Zod) |
| `VALIDATION_ERROR` | 400 | «Некорректный курсор постраничной навигации.» (невалидный `cursor`) |
| `DATASET_NOT_FOUND` | 404 | «Снимок расхождений не найден.» |
| `UNAUTHORIZED` | 401 | «Доступ запрещён.» (неверный import secret) |
| `EXPORT_TOO_LARGE` | 400 | «Слишком много строк для экспорта (лимит 500 000, найдено N). Сузьте фильтры.» |
| `RATE_LIMITED` | 429 | «Слишком много запросов. Повторите через N сек.» |
| `INTERNAL_ERROR` | 500 | «Внутренняя ошибка сервера. Попробуйте позже.» (без деталей в production) |

### External lookup API — коды (английский)

| Code | HTTP | message |
|------|------|---------|
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `SERVICE_UNAVAILABLE` | 503 | External API is not configured |
| `VALIDATION_ERROR` | 400 | Invalid phone parameter |

---

## Фильтры (query parameters)

Общий формат для `/api/ranges`, `/api/ranges/facets`, `/api/summary`, `/api/export/ranges`:

| Parameter | Формат | Описание |
|-----------|--------|----------|
| `filters.abc` | `301\|\|\|353` | Coverage AND, max 20 |
| `filters.operator` | values `|||` | Coverage AND, max 20 |
| `filters.region` | values `|||` | Coverage AND, max 20 |
| `filters.garTerritory` | values `|||` | Coverage AND, max 20 |
| `filters.inn` | values `|||` | OR, max 50 |
| `filters.uvrAntifraud` | values `|||` | OR, max 50 |
| `filters.changedFields` | values `|||` | OR, max 50; **только diff view** — см. ниже |
| `filters.rangeStart` | string | max 100 chars |
| `filters.rangeEnd` | string | max 100 chars |
| `filters.capacity` | string | max 100 chars |
| `filters.phoneNumber` | string | max 10 chars (internal mask slots) |

Разделитель массива: `|||`.

### `filters.changedFields` (diff snapshot)

Доступен при `dataset=diff:<uuid>`. Фильтрует строки по типу или полю изменения (OR):

| Значение | Смысл |
|----------|-------|
| `operator` | `changeType=changed`, оператор отличается |
| `region` | `changeType=changed`, регион отличается |
| `garTerritory` | `changeType=changed`, территория ГАР отличается |
| `inn` | `changeType=changed`, ИНН отличается |
| `added` | `changeType=added` |
| `removed` | `changeType=removed` |

Пример:

```bash
curl -s "http://127.0.0.1:5555/api/ranges?dataset=diff:550e8400-e29b-41d4-a716-446655440000&filters.changedFields=operator|||inn"
```

Facet-колонка `changedFields` поддерживается в `GET /api/ranges/facets?columns=changedFields,...`.

### Датасет (`dataset`)

Параметр `dataset` доступен для `/api/ranges`, `/api/ranges/facets`, `/api/summary`, `/api/export/ranges`, `/api/v1/lookup/search`.

| Значение | Описание |
|----------|----------|
| `current` (default) | Актуальная production-таблица `number_ranges` |
| `full:<uuid>` | Полная версия из `number_range_full_snapshots` |
| `diff:<uuid>` | Снимок расхождений из `number_range_diffs` (snapshot id) |

#### Параметр `asOf` (исторический full)

При `dataset=current` (default) можно передать `asOf=YYYY-MM-DD` (MSK). API выберет последний snapshot с `has_full=true` и `load_date ≤ asOf` и вернёт полную таблицу из `number_range_full_snapshots`. Если `asOf` ≥ даты текущего import — читается production без snapshot.

`asOf` **не сочетается** с `dataset=diff:*` или `dataset=full:*` (400).

#### Mapping `id` из `GET /api/datasets`

| kind | `items[].id` в ответе | Query param |
|------|----------------------|-------------|
| `current` | `"current"` | `dataset=current` (default, можно опустить) |
| `diff` | UUID | `dataset=diff:550e8400-e29b-41d4-a716-446655440000` |

Невалидный формат (`diff:not-a-uuid`) → **400** `VALIDATION_ERROR`.  
Неизвестный snapshot id → **404** `DATASET_NOT_FOUND`.

Подробнее: [import-and-datasets.md](import-and-datasets.md).

### Сортировка

`sort=column:asc` или `sort=column:desc`. Колонки: `abc`, `rangeStart`, `rangeEnd`, `capacity`, `operator`, `region`, `garTerritory`, `inn`.

---

## Endpoints

### `GET /api/health`

Healthcheck приложения и PostgreSQL.

**Auth:** нет

**Response 200 (production, default):**

```json
{ "status": "ok", "database": "ok" }
```

**Response 200 (verbose):** при `HEALTH_VERBOSE=1` или `NODE_ENV !== production`:

```json
{
  "status": "ok",
  "database": "ok",
  "version": "0.3.19",
  "revision": "abc123def",
  "nodeEnv": "production",
  "uptimeSec": 3600
}
```

Поля `version` и `revision` задаются при сборке образа (`APP_VERSION`, `APP_REVISION`).

**Response 503:**

```json
{ "status": "error", "database": "down", "message": "Database unavailable" }
```

В production UI **не отображает** номер версии — для проверки деплоя используйте verbose health, тег GHCR или GitHub Release.

---

### `GET /api/storage`

Размер базы PostgreSQL для блока «БД: X ГБ» в UI.

**Auth:** NPM (perimeter)

**Response 200:**

```json
{
  "databaseBytes": 2147483648,
  "formatted": "2.0 ГБ"
}
```

`formatted` — человекочитаемая строка (ГБ / МБ / КБ).

---

### `GET /api/datasets/change-dates`

Даты версий датасета для календаря «Дата датасета». Каждый элемент — день, для которого сохранён full snapshot (`has_full=true`).

**Auth:** NPM (perimeter)

**Response 200:**

```json
{
  "items": [
    {
      "loadDate": "2026-06-28",
      "snapshotId": "550e8400-e29b-41d4-a716-446655440000",
      "hasDiff": true
    },
    {
      "loadDate": "2026-06-22",
      "snapshotId": "660e8400-e29b-41d4-a716-446655440001",
      "hasDiff": false
    }
  ]
}
```

| Поле | Описание |
|------|----------|
| `loadDate` | Календарная дата MSK (`YYYY-MM-DD`) |
| `snapshotId` | UUID snapshot или `"current"` для текущего production load date без отдельной записи |
| `hasDiff` | Был ли import с ненулевым diff в этот день |

UI подсвечивает **все** дни из списка синим фоном в календаре (дни версий). Выбор недоступен для дат раньше минимального `loadDate` и для будущих дат.

---

### `GET /api/ranges`

Список диапазонов с фильтрами, сортировкой и keyset pagination.

**Auth:** NPM (perimeter). **Rate limit:** нет (facets rate-limited отдельно).

**Query:**

| Param | Default | Max | Описание |
|-------|---------|-----|----------|
| `page` | 1 | — | Offset page (если нет cursor) |
| `pageSize` | 50 | 200 | Размер страницы |
| `cursor` | — | — | Keyset cursor (infinite scroll) |
| `sort` | `abc:asc` | — | Сортировка |
| `dataset` | `current` | — | `current`, `full:<uuid>` или `diff:<uuid>` |
| `asOf` | — | — | Исторический full при `dataset=current` |
| `filters.*` | — | — | См. выше |

**Response 200:**

```json
{
  "data": [ { "id": 1, "abc": "301", "rangeStart": 2100000 } ],
  "meta": {
    "pageSize": 50,
    "totalRows": 446000,
    "hasMore": true,
    "sort": [{ "id": "abc", "desc": false }]
  }
}
```

Invalid filters → **400** `VALIDATION_ERROR`. Invalid cursor → **400** «Некорректный курсор постраничной навигации.»

---

### `GET /api/ranges/facets`

Опции для combobox-фильтров с counts.

**Auth:** NPM. **Rate limit:** 60 req / min (in-app).

**Query:**

| Param | Описание |
|-------|----------|
| `columns` | Список колонок: `abc`, `operator`, `region`, `garTerritory`, `inn`, `uvrAntifraud`, `changedFields` (последняя — только diff) |
| `search.<column>` | Поиск внутри фасета |
| `dataset` | `current` (default) или `diff:<uuid>` |
| `filters.*` | Контекстные фильтры |

**Response 200:**

```json
{
  "facets": {
    "abc": {
      "options": [{ "value": "301", "count": 1234, "selected": false }],
      "totalDistinct": 100
    }
  }
}
```

---

### `GET /api/summary`

KPI-агрегаты: число диапазонов, суммарная ёмкость, уникальные регионы и территории ГАР, операторы.

**Auth:** NPM

**Query:** `filters.*` (optional), `dataset` (optional), `asOf` (optional)

**Response 200:**

```json
{
  "loadedAt": "2026-06-22T12:00:00.000Z",
  "global": {
    "rangeCount": 446000,
    "totalCapacity": 1234567890,
    "uniqueRegions": 85,
    "uniqueGarTerritories": 210,
    "uniqueOperators": 1200
  },
  "filtered": { "...": "..." },
  "uvrBinding": {
    "registryOperators": 2848,
    "matchedDistinctInns": 1200
  }
}
```

---

### `GET /api/export/ranges`

Экспорт XLSX с текущими фильтрами.

**Auth:** NPM. **Rate limit:** 10 req / min (in-app).

**Query:** `filters.*`, `sort`, `dataset` (optional), `asOf` (optional)

**Limits:**

| Порог | HTTP |
|-------|------|
| ≤ 500 000 строк | 200, файл XLSX |
| > 500 000 строк | 400 `EXPORT_TOO_LARGE` |

**Response 200 headers:**

```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename=ranges-export.xlsx
X-Export-Row-Count: 12345
```

#### UI vs XLSX в diff-режиме

| Аспект | UI (`/ranges`, diff) | XLSX export |
|--------|------------------------|-------------|
| Оператор / ИНН | Одна колонка «Оператор связи», одна «ИНН» (новые значения) | Дополнительно «Старый оператор связи», «Новый оператор связи», «Старый ИНН», «Новый ИНН» |
| Изменения | Колонка «Изменения» (краткий список полей; диалог было/стало) | Колонка «Тип изменения» + old/new колонки |
| Фильтр | `filters.changedFields` | Те же query params |

---

### `GET /api/datasets`

Список доступных датасетов для UI-селектора: текущий (`current`) и снимки расхождений (`diff`).

**Auth:** NPM (perimeter)

**Response 200:**

```json
{
  "items": [
    {
      "id": "current",
      "kind": "current",
      "label": "Датасет 28.06.2026",
      "loadDate": "2026-06-28"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "kind": "diff",
      "label": "Расхождения 28.06.2026",
      "loadDate": "2026-06-28",
      "stats": { "added": 12, "changed": 3, "removed": 1 }
    }
  ]
}
```

---

### `POST /api/import`

Запуск полной перезагрузки 4 CSV.

**Auth:** NPM (+ optional `X-Import-Secret` для manual; **обязателен** для cron). **Rate limit:** 3 req / 10 min (in-app).

**Body (optional JSON):**

```json
{ "triggeredBy": "cron" }
```

**Response 200:**

```json
{ "jobId": "uuid", "status": "pending" }
```

---

### `GET /api/import/status`

Статус import job. Контракт типов: [`packages/shared/contracts/import.schema.ts`](../packages/shared/contracts/import.schema.ts) → `ImportStatusResponse`.

**Auth:** NPM (+ optional `X-Import-Secret`)

**Query:** `jobId` (optional UUID)

**Response 200:**

```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "skipReason": null,
  "loadedAt": "2026-06-28T09:00:00.000Z",
  "rowsLoaded": 120000,
  "errorMessage": null,
  "progress": {
    "phase": "loading_ABC-4xx",
    "phaseLabel": "Загрузка ABC-4xx…",
    "percent": 42,
    "filesProcessed": 1,
    "filesTotal": 4,
    "rowsLoaded": 69054,
    "files": [
      { "key": "ABC-3xx", "status": "done", "rows": 69054 },
      { "key": "ABC-4xx", "status": "loading", "rows": null }
    ],
    "steps": [
      { "id": "files", "label": "Загрузка файлов Минцифры", "status": "active" },
      { "id": "validating", "label": "Проверка полноты данных", "status": "pending" }
    ]
  }
}
```

| `status` | Описание |
|----------|----------|
| `pending` / `running` | Импорт выполняется |
| `completed` | Данные обновлены |
| `skipped` | CSV не изменились (`skipReason: "unchanged"`) |
| `failed` | Ошибка; `errorMessage` — технический текст (UI маппит на русский) |

`ImportStatusResponse` fields: `jobId`, `status`, `skipReason?`, `progress?`, `loadedAt`, `errorMessage?`, `rowsLoaded?`.

---

### `GET /api/v1/lookup`

Точный lookup по 10-значному номеру. **Всегда ищет в current production** — параметр `dataset` не поддерживается.

**Auth:** Bearer / `X-Api-Key`. **Rate limit:** 120 req / min (in-app).

**Query:** `phone` — ровно 10 цифр

**Response 200 (found):**

```json
{
  "found": true,
  "phone": "4996660000",
  "data": { "abc": "499", "rangeStart": 6660000, "operator": "..." }
}
```

**Response 404 (not found):**

```json
{ "found": false, "phone": "4996660000" }
```

---

### `GET /api/v1/lookup/search`

Поиск диапазонов по маске (как «Найти номер» в UI).

**Auth:** Bearer / `X-Api-Key`. **Rate limit:** 120 req / min (in-app).

**Query:** `phone`, `page`, `pageSize`, `dataset` (`current` или `diff:<uuid>`)

**Response 200:**

```json
{
  "phone": "499X66XXXX",
  "data": [],
  "meta": { "page": 1, "pageSize": 50, "totalRows": 123, "hasMore": false }
}
```

---

### `GET /api/v1/lookup/examples`

Готовые curl-примеры для UI (server-side generation).

**Auth:** NPM (perimeter). **Rate limit:** нет.

---

### `GET /api/v1/lookup/config`

Статус конфигурации lookup API (без ключа).

**Auth:** NPM

---

## Объект NumberRangeRow

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | number | PK |
| `abc` | string | ABC/DEF код |
| `rangeStart` | number | Начало диапазона |
| `rangeEnd` | number | Конец диапазона |
| `capacity` | number | Ёмкость |
| `operator` | string | Оператор (в diff — **новое** значение) |
| `garTerritory` | string | Территория ГАР |
| `region` | string | Регион |
| `inn` | string | ИНН (в diff — **новое** значение) |
| `uvrAntifraud` | number \| null | id_src OPR |
| `abcRangeGapBefore` | boolean | Пропуск ABC сверху |
| `abcRangeGapAfter` | boolean | Пропуск ABC снизу |
| `changeType` | `"added"` \| `"changed"` \| `"removed"` \| null | Только diff |
| `prevOperator` | string \| null | Старое значение (API/XLSX; в UI — диалог было/стало) |
| `prevInn` | string \| null | Старое значение ИНН |
| `prevRegion`, `prevGarTerritory`, `prevCapacity`, … | | Предыдущие метаданные для `changed` |

Поля `prev*` заполняются для сегментов diff; в UI-таблице отображаются через колонку «Изменения», в XLSX — отдельными old/new колонками.

---

## Связанные документы

- [import-and-datasets.md](import-and-datasets.md) — импорт, cron, diff snapshots (опорный документ)
- [security.md](security.md) — auth model, secrets, rate limits
- [user-guide.md](user-guide.md) — UI, сообщения об ошибках
- [deployment.md](deployment.md) — env vars, NPM rate limits
- [npm.md](npm.md) — настройка Proxy Host
