# История изменений

Формат: версии в порядке убывания. Проект: [PSTN Analytics](https://github.com/finenumbers/pstn).

---

## v0.3.45

### Export

- Юридический адрес в XLSX записывается текстом, без ссылки на Яндекс.Карты. Полный план больше не упирается в лимит гиперссылок Excel.
- После рестарта незавершённый экспорт сразу становится failed и не держит слот до 45 минут.
- Статус `completed` и прогресс пишутся только пока job в `running`. Отмена не оставляет успешный статус на удалённый файл.

### UI

- Столбцы «Емкость», «ИНН» и «УВр Антифрод» выровнены по правому краю.

---

## v0.3.44

### UI

- Таблица диапазонов совпадает с «Ресурсом нумерации» REG: IBM Plex Sans 12px, сетка, отступы шапки 28px и фильтр заголовка (название колонки, счётчик, поиск, чекбоксы).
- Колонки больше не обрезаются. Ширина считается по всем загруженным строкам, виртуализация остаётся.
- Сортировка, цвет строк и режим расхождений сохранены. Активный фильтр нейтральный, без синей заливки primary.

---

## v0.3.43

### UI

- Текст таблицы диапазонов, включая заголовки и кнопки фильтров, стал 10px. Ширина колонок в пикселях не изменилась.

---

## v0.3.42

### Data

- Таблица `party_addresses` хранит юридический адрес по ИНН. Миграция `0024_party_addresses.sql`.
- После записи нового датасета или расхождений адреса запрашиваются заново по всем уникальным ИНН и перезаписываются. Неизменённый CSV добирает только ИНН без строки в таблице.
- Ошибка DaData не отменяет уже загруженный план. Без `DADATA_API_KEY` колонка остаётся пустой, import завершается.

### API

- `NumberRangeRow` и строки lookup получили поле `legalAddress` (`string | null`).

### UI

- Колонка «Юридический адрес» стоит после «Территория ГАР» и перед «ИНН». Ссылка открывает поиск Яндекс.Карт в новой вкладке.
- Карточка импорта показывает, сколько уникальных ИНН уже запрошено и сколько адресов найдено.

---

## v0.3.41

### Data

- В базе остаётся один активный план (`number_ranges`) и строки расхождений по дню изменений. Полная копия плана на каждый день больше не пишется.
- Миграция `0023_drop_full_snapshots.sql` удаляет уже сохранённые `number_range_full_snapshots`, baseline без расхождений и выгрузки исторического плана.
- Следующий import с изменившимися CSV заменяет активный план целиком. Расхождения прошлых дней сохраняются; повтор в тот же день MSK перезаписывает только этот день.
- Откат только образа без backup базы ломает следующий import.

### API

- `dataset=full:<uuid>`, `asOf` и `GET /api/datasets/change-dates` больше не поддерживаются (400 / маршрут снят). Lookup search и by-inn принимают только `current` и `diff:<uuid>`.

### UI

- С панели убраны поле «Дата датасета», календарь и баннер «План на …». Селектор «Датасет / Расхождения» остаётся.
- Старые ссылки с `asOf` открывают текущий план, параметр из адреса выбрасывается.

---

## v0.3.40

### Data

- Колонка **«Регион»** удалена из таблицы, снимков, diff, фильтров, сортировки, KPI, экспорта и lookup API.
- CSV Минцифры не меняется: поле «Регион» читается и отбрасывается, «Территория ГАР» и ИНН остаются на своих местах.
- Миграция `0022_drop_region.sql` снимает колонку и индексы и убирает diff-строки, которые отличались только регионом.
- KPI: карточка **«Территории ГАР»** вместо «Регионы / Территории ГАР». Coverage AND остаётся для ABC и территории ГАР.
- После деплоя нужен полный импорт, чтобы новый diff собрался без региона.
- Зависимости подняты до версий без high/critical advisory (Next.js 15.5.28, Zod 4, Vitest 5 и точечные overrides), чтобы CI `npm audit` снова проходил.

---

## v0.3.39

### Filters

- **Оператор** при мультивыборе — обычный **OR** (как ИНН), а не Coverage AND. Выбор нескольких операторов больше не даёт пустую выборку.
- Coverage AND остаётся для **ABC / Регион / Территория ГАР**.
- Лимит значений `filters.operator`: до **50** (schema + URL).

### UI

- Строки таблицы: длинный текст в Оператор / Регион / ГАР — одна строка с `truncate` и полным текстом в `title` (hover).

---

## v0.3.38

### UI

- Компактнее строки таблицы диапазонов (`py-1`, высота виртуализатора 32px).
- Селектор **Датасет**: «Расхождения» сгруппированы двухуровнево — `Расхождения / MM.YYYY` → `DD.MM.YYYY` (по убыванию).

### Export XLSX

- Убрана принудительная высота строк — стандарт Excel для Calibri 11.

---

## v0.3.37

### Export XLSX

- **Без лимита строк:** убран `EXPORT_TOO_LARGE` / hard cap 500k — выгружается весь набор по фильтрам.
- **Hybrid sync/async:** ≤25k — sync GET; >25k — `POST /api/export/jobs` с прогрессом, download, cancel.
- Volume `pstn_exports` (`/app/data/exports`), TTL 6 часов, один running job (advisory lock).
- Оформление: Calibri 11, thin borders, AutoFilter, ширины по содержимому, заливки как в UI, красные ABC-gap разделители; multi-sheet при >~1.048M строк.
- UVR без тяжёлого JOIN — lookup map из `operators_register`.

### UI

- Подсветка строк: Фронтир — ярко-жёлтый; ABC 80x — синий; ABC 9xx — светло-зелёный.
- Баннер прогресса экспорта (строк записано / всего).

---

## v0.3.36

### API

- Default in-app rate limit для `/api/v1/lookup*`: **5000 req / min** (было 2000).

---

## v0.3.35

### API

- **Поиск по ИНН:** `GET /api/v1/lookup/by-inn?inn=<10|12 цифр>` — пагинированный список диапазонов оператора; поддержка `dataset`; пример curl в диалоге «API».

### UI

- Вертикальные отступы ячеек таблицы диапазонов уменьшены на **20%** (плотнее строки).

---

## v0.3.34

### Import

- **Быстрая загрузка CSV:** вторичные индексы снимаются со staging на время INSERT, восстанавливаются перед swap — production после подмены остаётся с индексами.
- **Прогресс по строкам:** процент и счётчик текущего файла во время `loading_*` (не фиксированные 28% на весь ABC-4xx).
- **Download:** total timeout 20 мин + idle timeout 2 мин без данных от Минцифры.
- **Логи:** каждые 10 батчей при загрузке файла; фаза `building_staging_indexes` перед swap.
- Миграция `0020_staging_drop_secondary_indexes.sql`.

---

## v0.3.33

### Import

- Оптимизация `computing_diff`: two-pointer lookup вместо O(n²) перебора — diff ~446k диапазонов за секунды вместо десятков минут.
- Heartbeat import job при загрузке ranges из БД и после каждого ABC-кода во время diff.
- Stale recovery при polling статуса (`getImportStatus`) — zombie jobs после рестарта контейнера сбрасываются без ожидания 45 мин.
- Логирование фаз `computing_diff` в stdout контейнера.

---

## v0.3.32

### API

- Default in-app rate limit для `/api/v1/lookup*`: **2000 req / min** (было 1800).

---

## v0.3.31

### API

- Default in-app rate limit для `/api/v1/lookup*`: **1800 req / min** (было 120).

---

## v0.3.30

### CI

- `npm overrides` для `brace-expansion`, `postcss`, `sharp` — разблокирован `npm audit --audit-level=high` в CI (Docker publish).

### UI (из v0.3.29, не опубликован в GHCR)

- Polling статуса import через Server Action `getImportStatusFromUi`.

---

## v0.3.29

### UI

- Кнопка «Загрузить данные»: polling статуса import через Server Action `getImportStatusFromUi` — без `X-Import-Secret` в браузере (исправлена ошибка после v0.3.27).

---

## v0.3.28

### Operations / Portainer

- `docker-compose.portainer.yml`: scheduler entrypoint inline (без bind mount `./scripts/...`) — совместимо с Portainer «no host bind mounts».

---

## v0.3.27

### Operations / Cron

- Scheduler: [`scripts/scheduler-entrypoint.sh`](../scripts/scheduler-entrypoint.sh) — env запекается при старте контейнера (`/etc/environment` + baked curl script), cron jobs не теряют `IMPORT_SECRET`.
- Compose: volume mount entrypoint вместо inline shell.

### UI

- Кнопка «Загрузить данные» — Server Action [`app/actions/import.ts`](../app/actions/import.ts); работает при включённом `IMPORT_SECRET` (без заголовка в браузере).

### Docs

- `portainer.env.example`: `IMPORT_SECRET` обязателен для scheduler.
- Post-deploy чеклист: проверка `pstn_scheduler`.

---

## v0.3.26

### Operations / Import

- Node.js: `NODE_OPTIONS=--use-openssl-ca` — `fetch` при import использует системные CA (включая Russian Trusted CA), как `wget`.

---

## v0.3.25

### Operations / Import

- Docker-образ app: встроены корневой и промежуточный **Russian Trusted CA** (НУЦ Минцифры) для TLS к `opendata.digital.gov.ru`.

---

## v0.3.24

### Operations

- Автоимпорт (cron `pstn_scheduler`): **18:00 MSK** вместо 12:00 MSK.

---

## v0.3.23

### UI — расхождения (diff)

- Колонка **«Статус»**: «Новый ресурс» / «Изменение ресурса» / «Удаление ресурса» с facet-фильтром.
- Колонка **«Изменения»** — только изменённые поля metadata для `changed`; facet показывает только присутствующие значения.
- Виджет детализации: «Предыдущая версия / Новая версия», статус события, поясняющий текст, цветовая подсветка по типу.

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
