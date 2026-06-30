# HTTP API Reference

Справочник REST API PSTN Analytics. Базовый URL: `http://127.0.0.1:5555` (локально) или публичный домен за NPM.

---

## Аутентификация

| Класс endpoints | Auth в приложении | Рекомендация |
|-----------------|-------------------|--------------|
| Internal (ranges, summary, export, import, examples, config, health) | **Нет** | NPM Access List |
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

| Code | HTTP | Описание |
|------|------|----------|
| `VALIDATION_ERROR` | 400 | Невалидные параметры (Zod issues в `details`) |
| `DATASET_NOT_FOUND` | 404 | Неизвестный snapshot (`dataset=diff:<uuid>`) |
| `UNAUTHORIZED` | 401 | Неверный API key или import secret |
| `SERVICE_UNAVAILABLE` | 503 | External API не настроен (`EXTERNAL_API_KEY`) |
| `EXPORT_TOO_LARGE` | 400 | Export > 500 000 строк |
| `INTERNAL_ERROR` | 500 | Внутренняя ошибка (без деталей в production) |

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
| `filters.rangeStart` | string | max 100 chars |
| `filters.rangeEnd` | string | max 100 chars |
| `filters.capacity` | string | max 100 chars |
| `filters.phoneNumber` | string | max 10 chars (internal mask slots) |

Разделитель массива: `|||`.

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

#### Endpoints

| Endpoint | Описание |
|----------|----------|
| `GET /api/datasets/change-dates` | Даты версий для календаря (`loadDate`, `hasDiff`) |
| `GET /api/storage` | `{ databaseBytes, formatted }` — размер БД |

Невалидный формат (`diff:not-a-uuid`) → **400** `VALIDATION_ERROR`.  
Неизвестный snapshot id → **404** `DATASET_NOT_FOUND`.

#### Mapping `id` из `GET /api/datasets`

Ответ `GET /api/datasets` и query param `dataset` используют **разный формат** для diff snapshots:

| kind | `items[].id` в ответе | Query param |
|------|----------------------|-------------|
| `current` | `"current"` | `dataset=current` (default, можно опустить) |
| `diff` | UUID, напр. `550e8400-e29b-41d4-a716-446655440000` | `dataset=diff:550e8400-e29b-41d4-a716-446655440000` |

Пример:

```bash
curl -s "http://127.0.0.1:5555/api/ranges?dataset=diff:550e8400-e29b-41d4-a716-446655440000&pageSize=10"
```

#### Жизненный цикл diff snapshot

- Snapshot создаётся **только после успешного swap** production и **только если** алгоритм diff нашёл сегменты (`added` / `changed` / `removed`).
- `load_date` — календарная дата в **Europe/Moscow**; constraint UNIQUE — один snapshot на MSK-день.
- Повторный import с diff в тот же MSK-день **перезаписывает** snapshot этого дня (upsert).
- Автоматического удаления старых snapshots **нет**.

Подробнее: [import-and-datasets.md](import-and-datasets.md).

### Сортировка

`sort=column:asc` или `sort=column:desc`. Колонки: `abc`, `rangeStart`, `rangeEnd`, `capacity`, `operator`, `region`, `garTerritory`, `inn`.

---

## Endpoints

### `GET /api/health`

Healthcheck приложения и PostgreSQL.

**Auth:** нет

**Response 200:**

```json
{ "status": "ok", "database": "ok" }
```

**Response 503:**

```json
{ "status": "error", "database": "down", "message": "..." }
```

---

### `GET /api/ranges`

Список диапазонов с фильтрами, сортировкой и keyset pagination.

**Auth:** NPM (perimeter)

**Query:**

| Param | Default | Max | Описание |
|-------|---------|-----|----------|
| `page` | 1 | — | Offset page (если нет cursor) |
| `pageSize` | 50 | 200 | Размер страницы |
| `cursor` | — | — | Keyset cursor (infinite scroll) |
| `sort` | `abc:asc` | — | Сортировка |
| `dataset` | `current` | — | `current` или `diff:<uuid>` |
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

Invalid filters → **400** `VALIDATION_ERROR`.

---

### `GET /api/ranges/facets`

Опции для combobox-фильтров с counts.

**Auth:** NPM

**Query:**

| Param | Описание |
|-------|----------|
| `columns` | Список колонок через запятую: `abc`, `operator`, `region`, `garTerritory`, `inn`, `uvrAntifraud` |
| `search.<column>` | Поиск внутри фасета (max длина — см. `FILTER_LIMITS`) |
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

**Query:** `filters.*` (optional), `dataset` (optional)

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
  "filtered": {
    "rangeCount": 446000,
    "totalCapacity": 1234567890,
    "uniqueRegions": 85,
    "uniqueGarTerritories": 210,
    "uniqueOperators": 1200
  },
  "uvrBinding": {
    "registryOperators": 2848,
    "matchedDistinctInns": 1200
  }
}
```

Без активных фильтров `filtered` совпадает с `global`.

---

### `GET /api/export/ranges`

Экспорт XLSX с текущими фильтрами.

**Auth:** NPM

**Query:** `filters.*`, `sort`, `dataset` (optional)

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

**Auth:** NPM (+ optional `X-Import-Secret` для manual; **обязателен** для cron)

**Body (optional JSON):**

```json
{ "triggeredBy": "cron" }
```

| `triggeredBy` | Поведение |
|---------------|-----------|
| omitted / `"manual"` | Ручной импорт из UI |
| `"cron"` | Плановый импорт; требует `X-Import-Secret` |

**Response 200:**

```json
{ "jobId": "uuid", "status": "pending" }
```

Если import уже running — возвращает существующий job.

---

### `GET /api/import/status`

Статус import job.

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
| `failed` | Ошибка; production не изменён (если ошибка до swap) |

При `status: "skipped"` объект `progress` содержит сокращённые steps, `percent: 100`, `filesProcessed: 0`.

---

### `GET /api/v1/lookup`

Точный lookup по 10-значному номеру. **Всегда ищет в current production** — параметр `dataset` не поддерживается.

**Auth:** Bearer / `X-Api-Key`

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

**Пример:**

```bash
curl -s "https://pstn.example.com/api/v1/lookup?phone=4996660000" \
  -H "Authorization: Bearer YOUR_KEY"
```

---

### `GET /api/v1/lookup/search`

Поиск диапазонов по маске (как «Найти номер» в UI).

**Auth:** Bearer / `X-Api-Key`

**Query:**

| Param | Default | Max | Описание |
|-------|---------|-----|----------|
| `phone` | required | — | Маска: цифры + `X` (wildcards) |
| `page` | 1 | — | Страница |
| `pageSize` | 50 | 100 | Размер страницы |
| `dataset` | `current` | — | `current` или `diff:<uuid>` |

**Response 200:**

```json
{
  "phone": "499X66XXXX",
  "data": [],
  "meta": { "page": 1, "pageSize": 50, "totalRows": 123, "hasMore": false }
}
```

Возвращает 200 даже при 0 результатах.

**Пример:**

```bash
curl -s "https://pstn.example.com/api/v1/lookup/search?phone=499X66XXXX&page=1&pageSize=50" \
  -H "Authorization: Bearer YOUR_KEY"
```

---

### `GET /api/v1/lookup/examples`

Готовые curl-примеры для UI (server-side generation).

**Auth:** NPM (perimeter)

**Query:** `phoneMask` (optional), `dataset` (optional)

**Response 200:**

```json
{
  "configured": true,
  "baseUrl": "https://pstn.example.com",
  "exactCurl": "curl -s \"...\" -H \"Authorization: Bearer <EXTERNAL_API_KEY>\"",
  "searchCurl": "curl -s \"...\" -H \"Authorization: Bearer <EXTERNAL_API_KEY>\""
}
```

Поле `apiKey` **отсутствует** — ключ встроен в готовые curl-строки (`exactCurl`, `searchCurl`) для copy-paste из UI.

**Response 503:** lookup API не настроен.

---

### `GET /api/v1/lookup/config`

Статус конфигурации lookup API (без ключа).

**Auth:** NPM

**Response 200:**

```json
{ "configured": true, "baseUrl": "https://pstn.example.com" }
```

---

## Объект NumberRangeRow

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | number | PK |
| `abc` | string | ABC/DEF код |
| `rangeStart` | number | Начало диапазона |
| `rangeEnd` | number | Конец диапазона |
| `capacity` | number | Ёмкость |
| `operator` | string | Оператор |
| `garTerritory` | string | Территория ГАР (как в CSV) |
| `region` | string | Регион (как в CSV) |
| `inn` | string | ИНН |
| `uvrAntifraud` | number \| null | id_src OPR |
| `abcRangeGapBefore` | boolean | Пропуск ABC сверху |
| `abcRangeGapAfter` | boolean | Пропуск ABC снизу |
| `changeType` | `"added"` \| `"changed"` \| `"removed"` \| null | Тип расхождения (только в diff-режиме). `changed` — только при отличии метаданных на сегменте (см. [import-and-datasets.md](import-and-datasets.md#алгоритм-diff)) |
| `prevRangeStart` | number \| null | Предыдущее начало (changed) |
| `prevRangeEnd` | number \| null | Предыдущий конец (changed) |
| `prevOperator` | string \| null | Предыдущий оператор (changed); в UI/XLSX — колонка «Старый оператор связи» |
| `prevRegion` | string \| null | Предыдущий регион (changed) |
| `prevGarTerritory` | string \| null | Предыдущая территория ГАР (changed) |
| `prevInn` | string \| null | Предыдущий ИНН (changed); в UI/XLSX — колонка «Старый ИНН» |
| `prevCapacity` | number \| null | Предыдущая ёмкость (changed) |

Поля `operator` и `inn` в diff rows — **новые** значения. Для отображения old/new в UI и XLSX используется единая семантика: `added` → старые колонки `—`, `removed` → новые `—`, `changed` → `prevOperator`/`prevInn` vs `operator`/`inn`.

Пример строки в diff mode (`changed` — смена оператора на сегменте):

```json
{
  "abc": "550",
  "rangeStart": 5500,
  "rangeEnd": 5599,
  "operator": "ООО \"Новый оператор\"",
  "inn": "7700000000",
  "changeType": "changed",
  "prevRangeStart": 5500,
  "prevRangeEnd": 5599,
  "prevOperator": "ПАО \"Старый оператор\"",
  "prevInn": "7700000001"
}
```

---

## Связанные документы

- [import-and-datasets.md](import-and-datasets.md) — импорт, cron, diff snapshots (опорный документ)
- [security.md](security.md) — auth model, secrets
- [user-guide.md](user-guide.md) — UI и семантика фильтров
- [deployment.md](deployment.md) — NPM rate limits
- [npm.md](npm.md) — настройка Proxy Host
