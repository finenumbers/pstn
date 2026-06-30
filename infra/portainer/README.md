# Portainer Stack — PSTN Analytics

## Compose path (обязательно)

```
docker-compose.portainer.yml
```

**Только** `docker-compose.portainer.yml` — без `build:`, без bind mounts, образ **`ghcr.io/finenumbers/pstn:latest`**. Контейнер `pstn_app` подключается к сети **`proxy`** для NPM.

> **Зелёная галочка** у stack = контейнеры **запущены**, не «образ свежий». После релиза: **Pull and redeploy** (compose с `pull_policy: always`). Проверка: под заголовком на сайте «Версия X.Y.Z».

> **Control: Limited?** Stack создан через SSH — Portainer не тянет GHCR. [Пересоздание stack](../../docs/deployment.md#stack-limited-created-outside-of-portainer)

## Быстрый старт

| Поле | Значение |
|------|----------|
| Repository URL | `https://github.com/finenumbers/pstn` |
| Reference | `main` |
| **Compose path** | **`docker-compose.portainer.yml`** |
| Environment | [`portainer.env.example`](../../portainer.env.example) — достаточно `POSTGRES_PASSWORD` |

Обновление после push в `main`: дождитесь CI + GHCR → **Pull and redeploy** (не rebuild на сервере).

Полная инструкция: **[docs/deployment.md](../../docs/deployment.md)** · NPM: **[docs/npm.md](../../docs/npm.md)**

---

**Finenumbers** · [finenumbers.com](https://finenumbers.com) · [apps@finenumbers.com](mailto:apps@finenumbers.com)
