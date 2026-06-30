# NGINX Proxy Manager (NPM) и PSTN

Краткое руководство: как вывести PSTN Analytics в интернет через **NGINX Proxy Manager**, если NPM у вас настроен по-разному.

PSTN **не содержит** NPM в своём compose. Production stack: **postgres + app + scheduler** (cron-импорт). Локальный dev stack — postgres + app **без** scheduler. SSL, домены и доступ настраиваются **в NPM отдельно**.

---

## С чего начать: где у вас работает NPM?

От этого зависит поле **Forward Hostname / IP** в Proxy Host. Ошибка здесь — самая частая причина **502 Bad Gateway**.

```
                    ┌─────────────────────────────────────┐
                    │  Где запущен NGINX Proxy Manager?   │
                    └─────────────────┬───────────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              │                                               │
              ▼                                               ▼
   NPM в Docker (Portainer, stack nginx)          NPM на хосте (bare metal / systemd)
              │                                               │
              ▼                                               ▼
   Forward: pstn_app :5555                        Forward: 127.0.0.1 :5555
   + сеть proxy                                   (app слушает localhost хоста)
```

| Ваш случай | Признаки | Forward Hostname / IP | Forward Port |
|------------|----------|------------------------|--------------|
| **A. NPM в Docker** | Stack `nginx` / `npm` в Portainer; сеть `proxy` в списке Networks | **`pstn_app`** | `5555` |
| **B. NPM на хосте** | NPM установлен не в контейнере; `docker ps` не показывает nginx-proxy-manager | **`127.0.0.1`** | `5555` |

> **Важно:** если NPM в Docker, **`127.0.0.1` не работает** — это localhost **контейнера NPM**, а не сервера и не PSTN.

---

## Сценарий A — NPM в Docker (Portainer)

Типичная схема Finenumbers: stack **nginx** (NPM) + stack **pstn**, общая сеть **`proxy`**.

### Шаг 1. Убедитесь, что PSTN подключён к сети `proxy`

Portainer → **Containers** → `pstn_app` → **Networks** — должны быть:

- `pstn_internal` (связь с PostgreSQL)
- **`proxy`** (связь с NPM)

В актуальном [`docker-compose.portainer.yml`](../docker-compose.portainer.yml) сеть `proxy` уже прописана. Если её нет — **Stacks** → `pstn` → **Pull and redeploy**.

Сеть `proxy` создаётся при деплое stack NPM (часто stack называется `nginx`).

### Шаг 2. Proxy Host в NPM

NPM → **Hosts** → **Proxy Hosts** → **Add Proxy Host** (или Edit):

**Details**

| Поле | Значение |
|------|----------|
| Domain Names | ваш домен, напр. `pstn.finenumbers.com` |
| Scheme | `http` |
| Forward Hostname / IP | **`pstn_app`** |
| Forward Port | `5555` |
| Cache Assets | выключить |
| Block Common Exploits | включить |
| Websockets Support | **выключить** (PSTN не использует WebSocket) |
| Access List | не «Publicly Accessible» для production — whitelist или Basic Auth |

**SSL**

| Поле | Значение |
|------|----------|
| SSL Certificate | Request a new SSL Certificate (Let's Encrypt) |
| Force SSL | включить |

DNS: A-запись домена → IP сервера **до** запроса сертификата.

### Шаг 3. Переменная в stack PSTN

Portainer → Stacks → `pstn` → **Environment variables**:

```env
EXTERNAL_API_BASE_URL=https://pstn.finenumbers.com
```

(подставьте свой домен). **Update the stack** — для корректных curl-примеров lookup API в UI.

### Шаг 4. Проверка

```bash
# на сервере — app жив
curl -sf http://127.0.0.1:5555/api/health

# через домен — NPM проксирует
curl -sf https://pstn.finenumbers.com/api/health
```

Ожидается: `{"status":"ok","database":"ok"}`

В браузере: `https://pstn.finenumbers.com/ranges`

---

## Сценарий B — NPM на хосте (не в Docker)

Stack PSTN публикует app на **`127.0.0.1:5555`** — только localhost сервера. NPM на том же хосте может обращаться к этому адресу.

NPM → **Proxy Hosts** → **Add**:

| Поле | Значение |
|------|----------|
| Domain Names | `pstn.example.com` |
| Scheme | `http` |
| Forward Hostname / IP | **`127.0.0.1`** |
| Forward Port | **`5555`** |
| Block Common Exploits | включить |
| Websockets Support | выключить |
| SSL | Let's Encrypt + Force SSL |

`EXTERNAL_API_BASE_URL=https://pstn.example.com` — в `.env` или переменных stack.

---

## Сценарий C — другое имя сети или контейнера

Если у вас не `proxy` / не `pstn_app`:

| Что проверить | Где |
|---------------|-----|
| Имя контейнера app | Portainer → Containers → колонка **Name** (часто `pstn_app`) |
| Имя Docker-сети NPM | Portainer → Networks → сеть, к которой подключён контейнер NPM |
| Подключение app к сети NPM | Containers → `pstn_app` → **Join network** → сеть NPM |

В NPM укажите **Forward Hostname = имя контейнера app**, **Port = 5555**.

Если сеть NPM называется иначе (напр. `npm_default`), в [`docker-compose.portainer.yml`](../docker-compose.portainer.yml) замените:

```yaml
networks:
  proxy:
    external: true
    name: proxy   # ← ваше имя сети
```

---

## Частые ошибки

| Симптом | Причина | Решение |
|---------|---------|---------|
| **502 Bad Gateway** | NPM в Docker, Forward = `127.0.0.1` | Forward → **`pstn_app`**, redeploy stack `pstn` |
| **502 Bad Gateway** | `pstn_app` не в сети NPM | Join network **`proxy`** или Pull and redeploy |
| **502 Bad Gateway** | App не запущен | `curl http://127.0.0.1:5555/api/health` на сервере |
| **504** (только Portainer UI) | NPM обрывает длинный deploy | Таймауты в Advanced для proxy Portainer или `:9443` напрямую |
| SSL не выпускается | DNS не указывает на сервер | A-запись, подождать propagation |
| UI открыт всем | Access List = Publicly Accessible | Whitelist / Basic Auth / VPN |

### Почему `127.0.0.1` и `pstn_app` — не взаимозаменяемы

```
  [Браузер] → [NPM контейнер] → ??? → [pstn_app :5555]
                                    │
                    127.0.0.1 ──────┘  ✗ localhost NPM, не PSTN
                    pstn_app ─────────  ✓ имя контейнера в сети proxy
```

На **хосте** `curl http://127.0.0.1:5555` работает — порт проброшен из контейнера.  
Из **контейнера NPM** тот же `127.0.0.1` — это уже другой «localhost».

---

## Безопасность (кратко)

- В PSTN **нет** логина — защита на NPM: **Access List**, Basic Auth, VPN.
- Рекомендуется **rate limiting** на тяжёлые endpoints (`/api/export/ranges`, `/api/import`). Cron scheduler вызывает import **раз в сутки**; rate limit не должен блокировать плановый cron, но защищает от злоупотреблений manual import. Подробнее: [deployment.md](deployment.md#rate-limiting), [import-and-datasets.md](import-and-datasets.md).
- `/api/health` не выставляйте публично без необходимости.

Полная модель: [security.md](security.md).

---

## Таймауты NPM для Portainer (опционально)

Если UI Portainer открыт через NPM и deploy stack даёт **504**, в Proxy Host **Portainer** → **Advanced**:

```nginx
proxy_connect_timeout 600;
proxy_send_timeout 600;
proxy_read_timeout 600;
send_timeout 600;
```

Или Portainer напрямую: `https://<server-ip>:9443`.

---

## Чеклист после настройки

- [ ] `curl http://127.0.0.1:5555/api/health` → `ok`
- [ ] `curl https://<домен>/api/health` → `ok`
- [ ] `/ranges` открывается по HTTPS
- [ ] Forward в NPM соответствует сценарию A или B
- [ ] `pstn_app` в сети `proxy` (если NPM в Docker)
- [ ] `EXTERNAL_API_BASE_URL=https://<домен>` в stack
- [ ] Access List не «Publicly Accessible» (production)

---

## Связанные документы

- [import-and-datasets.md](import-and-datasets.md) — импорт, cron, diff snapshots
- [deployment.md](deployment.md) — Portainer, переменные окружения, rate limits
- [operations.md](operations.md) — troubleshooting, backup, обновления
- [security.md](security.md) — периметр и секреты
- [infra/portainer/README.md](../infra/portainer/README.md) — быстрый старт stack в Portainer
