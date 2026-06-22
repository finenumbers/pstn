# Portainer Stack — PSTN Analytics

## Compose path (обязательно)

```
docker-compose.portainer.yml
```

**Только** `docker-compose.portainer.yml` — без `build:`, без bind mounts, образы с GHCR (`ghcr.io/finenumbers/pstn:latest`). После push в `main`: **Pull and redeploy** (работает только при **Control: Total**).

> **Control: Limited?** Stack создан через SSH `docker compose up` — Portainer не управляет образами, индикатор «Images up to date» не работает. [Пересоздание stack](../../docs/deployment.md#stack-limited-created-outside-of-portainer)

## Быстрый старт

| Поле | Значение |
|------|----------|
| Repository URL | `https://github.com/finenumbers/pstn` |
| Reference | `main` |
| **Compose path** | **`docker-compose.portainer.yml`** |
| Environment | [`portainer.env.example`](../../portainer.env.example) — достаточно `POSTGRES_PASSWORD` |

Полная инструкция: **[docs/deployment.md](../../docs/deployment.md)**

---

**Finenumbers** · [finenumbers.com](https://finenumbers.com) · [apps@finenumbers.com](mailto:apps@finenumbers.com)
