# Безопасность PSTN Analytics

Модель безопасности, аутентификация API, управление секретами и рекомендации по hardening в production.

---

## Принцип: perimeter-first

Приложение **не реализует** web-сессии, логин/пароль или RBAC. Защита рассчитана на размещение **за reverse proxy** (NGINX Proxy Manager) с:

- TLS (Let's Encrypt)
- Access List / Basic Auth / IP whitelist
- Rate limiting на прокси

```mermaid
flowchart TB
  subgraph perimeter [Периметр]
    npm[NPM Access List + SSL + rate limits]
  end
  subgraph app_layer [Приложение]
    internal[Internal API без auth]
    lookup[External lookup API Bearer key]
  end
  npm --> internal
  npm --> lookup
```

---

## Что защищено и чем

| Компонент | Защита | Примечание |
|-----------|--------|------------|
| UI `/ranges` | NPM Access List | Нет in-app auth |
| Internal API (`/api/ranges`, `/api/summary`, `/api/export`, `/api/import`, `/api/v1/lookup/examples`) | NPM | Полный доступ к данным при обходе периметра |
| External lookup (`/api/v1/lookup`, `/api/v1/lookup/search`) | Bearer / `X-Api-Key` | Timing-safe compare |
| PostgreSQL | Docker internal network | Не публикуется в prod compose |
| Import API | NPM + опционально `IMPORT_SECRET` | UI import без secret работает только за NPM |
| Secrets on disk | Volume `pstn_secrets`, chmod 600 | Ключ не в логах entrypoint |

---

## Internal API (без аутентификации в приложении)

Следующие endpoints **не проверяют** credentials на уровне приложения:

- `GET /api/ranges`, `/api/ranges/facets`, `/api/summary`
- `GET /api/export/ranges`
- `POST /api/import`, `GET /api/import/status`
- `GET /api/v1/lookup/examples`, `/api/v1/lookup/config`
- `GET /api/health`

**Mitigation:** NPM Access List, VPN, bind app на `127.0.0.1:5555`, rate limits.

Invalid filters на `/api/ranges` возвращают **400** (не silent fallback) — снижает риск некорректных запросов, но не заменяет auth.

---

## External lookup API

Endpoints:

- `GET /api/v1/lookup?phone=<10 digits>`
- `GET /api/v1/lookup/search?phone=<mask>&page=&pageSize=`

### Аутентификация

Поддерживаются:

```http
Authorization: Bearer <EXTERNAL_API_KEY>
```

или

```http
X-Api-Key: <EXTERNAL_API_KEY>
```

Реализация: [`lib/api/externalApiAuth.ts`](../lib/api/externalApiAuth.ts)

- Сравнение ключа — **timing-safe** ([`lib/api/safeEqual.ts`](../lib/api/safeEqual.ts))
- При отсутствии `EXTERNAL_API_KEY` → **503** `SERVICE_UNAVAILABLE`
- Неверный ключ → **401** `UNAUTHORIZED`

### Ключ API

| Способ | Описание |
|--------|----------|
| Auto-generate | При первом старте контейнера → `/app/.secrets/external_api_key` |
| Fixed env | `EXTERNAL_API_KEY=...` в `.env` / Portainer |
| Retrieval | `docker compose exec app cat /app/.secrets/external_api_key` |

Ключ **не** выводится в логи entrypoint (только путь к файлу).

### UI: curl-примеры без утечки ключа в JSON

- `GET /api/v1/lookup/config` → `{ configured, baseUrl }` — **без** поля `apiKey`
- `GET /api/v1/lookup/examples?phoneMask=...` → `{ exactCurl, searchCurl, baseUrl }` — ключ только внутри готовых curl-строк

Доступ к `/examples` не защищён на уровне app — полагайтесь на NPM.

---

## Import API

`POST /api/import`, `GET /api/import/status`

### Опциональный `IMPORT_SECRET`

Если задан `IMPORT_SECRET` в env:

- Запросы должны содержать заголовок `X-Import-Secret: <value>`
- Проверка — timing-safe ([`lib/api/importAuth.ts`](../lib/api/importAuth.ts))

**Важно:** кнопка «Загрузить данные» в UI **не** отправляет этот заголовок. При включённом `IMPORT_SECRET` UI-import перестанет работать — используйте NPM Access List вместо secret или вызывайте import через curl с заголовком.

---

## Обработка ошибок

[`lib/api/errors.ts`](../lib/api/errors.ts):

- Production: `internalServerError()` **не** отдаёт `error.message` клиенту — generic fallback
- Development: детали ошибки в ответе для отладки
- Validation: `{ error: { code: "VALIDATION_ERROR", message, details: { issues } } }`

Формат ошибок:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

---

## HTTP security headers

[`next.config.ts`](../next.config.ts) для всех routes:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

CSP, HSTS — настраиваются на NPM (рекомендуется HSTS при SSL).

---

## Export: защита от formula injection

[`lib/export/sanitizeSpreadsheetCell.ts`](../lib/export/sanitizeSpreadsheetCell.ts) — префикс `'`` для ячеек, начинающихся с `=`, `+`, `-`, `@`, чтобы Excel/LibreOffice не интерпретировали данные как формулы.

---

## PostgreSQL

- Production compose: postgres **без** `ports:` — только internal network
- Dev `docker-compose.yml`: postgres на `127.0.0.1:5432` (не `0.0.0.0`)
- Пароли только через env, не в репозитории

---

## Зависимости и CI

- `npm run audit` → `npm audit --audit-level=high`
- CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) падает на high/critical CVE
- Moderate advisories (esbuild dev, postcss, uuid/exceljs) — приняты, не блокируют CI

---

## Threat model (кратко)

| Угроза | Риск | Mitigation |
|--------|------|------------|
| Несанкционированный доступ к UI/API | Высокий | NPM Access List, VPN, localhost bind |
| Scraping lookup/export | Средний | Rate limits на NPM |
| Утечка EXTERNAL_API_KEY | Средний | Не в JSON config; volume; не в logs |
| DoS через import reload | Средний | Rate limit `/api/import`, один job за раз (advisory lock) |
| SQL injection | Низкий | Drizzle parameterization, контролируемый `sql.raw` |
| Утечка stack trace в prod | Низкий | `internalServerError()` sanitization |
| Excel formula injection | Низкий | `sanitizeSpreadsheetCell` |
| Обход lookup auth | Низкий | Timing-safe key compare |

---

## Checklist production

- [ ] NPM: SSL + Access List на всех proxy hosts
- [ ] App слушает только `127.0.0.1:5555` или доступен только из docker-сети NPM
- [ ] Сильный `POSTGRES_PASSWORD`, не default
- [ ] `EXTERNAL_API_BASE_URL` задан для корректных curl-примеров
- [ ] Rate limits на export, lookup, import
- [ ] `/api/health` не exposed публично без необходимости
- [ ] Backup БД настроен ([operations.md](operations.md))
- [ ] Ключ lookup сохранён в password manager после первого deploy

---

## Связанные документы

- [deployment.md](deployment.md) — NPM, Portainer, env vars
- [npm.md](npm.md) — NGINX Proxy Manager
- [api-reference.md](api-reference.md) — endpoints и auth
- [operations.md](operations.md) — эксплуатация и troubleshooting
