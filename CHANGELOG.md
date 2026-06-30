# История изменений

Формат: версии в порядке убывания. Проект: [PSTN Analytics](https://github.com/finenumbers/pstn).

---

## v0.3.20

### UI — сообщения об ошибках

- Единый формат ошибок API и русскоязычные сообщения для страницы `/ranges`.
- Rate limit (429): «Слишком много запросов. Повторите через N сек.»
- Import / export / pagination / facets / KPI — понятные тексты вместо технических English-сообщений.
- Toast с вариантом `error` (красная рамка).

### Документация

- Полная актуализация `docs/*`, карта документации в `docs/README.md`.

---

## v0.3.19

### Security (medium hardening)

- In-app rate limiting: import, export, facets, lookup API.
- CSP + HSTS (production) в `next.config.ts`.
- `/api/health` в production — минимальный JSON.
- Dev Postgres (`docker-compose.dev.yml`) — bind `127.0.0.1:5432`.

### UI

- Заголовок: «Телефонная нумерация России» (шапка, вкладка, user guide).

### Уборка кода

- Удалены мёртвые экспорты и `scripts/debug-diff-hidden-fields.ts`.

---

## v0.3.18

- Ширина «Датасет»: `w-fit min-w-[8ch]` (кросс-платформенно).

## v0.3.17

- «БД: …» между «Датасет» и «API»; ширина датасета 196px (заменена в v0.3.18).

## v0.3.16

- Date picker: layout, calendar version-day highlight.

## Ранее

См. [GitHub Releases](https://github.com/finenumbers/pstn/releases).
