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
| `columns` | Список колонок через запятую |
| `search.<column>` | Поиск внутри фасета |
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

**Query:** `filters.*` (optional)

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
  "filtered": {}
}
```

---

### `GET /api/export/ranges`

Экспорт XLSX с текущими фильтрами.

**Auth:** NPM

**Query:** `filters.*`, `sort`

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

### `POST /api/import`

Запуск полной перезагрузки 4 CSV.

**Auth:** NPM (+ optional `X-Import-Secret`)

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

**Response 200:** объект с `jobId`, `status`, `progress`, `rowsLoaded`, `filesProcessed`, `errorMessage`, ...

---

### `GET /api/v1/lookup`

Точный lookup по 10-значному номеру.

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

**Query:** `phoneMask` (optional) — маска из поля «Найти номер»

**Response 200:**

```json
{
  "configured": true,
  "baseUrl": "https://pstn.example.com",
  "exactCurl": "curl -s \"...\" -H \"Authorization: Bearer ...\"",
  "searchCurl": "curl -s \"...\" -H \"Authorization: Bearer ...\""
}
```

Поле `apiKey` **отсутствует** — ключ только внутри curl-строк.

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

---

## Связанные документы

- [security.md](security.md) — auth model, secrets
- [user-guide.md](user-guide.md) — UI и семантика фильтров
- [deployment.md](deployment.md) — NPM rate limits
- [npm.md](npm.md) — настройка Proxy Host
