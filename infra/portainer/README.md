# Portainer Stack — PSTN Analytics

## Compose path (обязательно)

```
docker-compose.portainer.yml
```

**Только** `docker-compose.portainer.yml` — без `build:`, без bind mounts, образ **`ghcr.io/finenumbers/pstn:${PSTN_IMAGE_TAG}`** (semver из [Releases](https://github.com/finenumbers/pstn/releases), **не `:latest`**). Контейнер `pstn_app` подключается к сети **`proxy`** для NPM.

> **Зелёная галочка** у stack в Portainer = контейнеры **запущены**, а не «образ актуален». Обновление — смена `PSTN_IMAGE_TAG` + Pull and redeploy; версия на сайте под заголовком должна совпадать с релизом.

> **Control: Limited?** Stack создан через SSH `docker compose up` — Portainer не управляет образами, индикатор «Images up to date» не работает. [Пересоздание stack](../../docs/deployment.md#stack-limited-created-outside-of-portainer)

## Быстрый старт

| Поле | Значение |
|------|----------|
| Repository URL | `https://github.com/finenumbers/pstn` |
| Reference | `main` |
| **Compose path** | **`docker-compose.portainer.yml`** |
| Environment | [`portainer.env.example`](../../portainer.env.example) — **`POSTGRES_PASSWORD`** и **`PSTN_IMAGE_TAG`** (обязательны) |

Обновление после релиза: задайте `PSTN_IMAGE_TAG=<версия>` → **Pull and redeploy** (не rebuild на сервере). Проверка: под заголовком на сайте «Версия X.Y.Z» или `GET /api/health`.

Полная инструкция: **[docs/deployment.md](../../docs/deployment.md)** · NPM: **[docs/npm.md](../../docs/npm.md)**

---

**Finenumbers** · [finenumbers.com](https://finenumbers.com) · [apps@finenumbers.com](mailto:apps@finenumbers.com)
