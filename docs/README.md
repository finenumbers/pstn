# Документация PSTN Analytics

Веб-сервис аналитики телефонного плана нумерации России. В интерфейсе заголовок страницы — **«Телефонная нумерация России»**; имя продукта в репозитории и Docker — **PSTN Analytics**.

---

## Кому что читать

| Документ | Аудитория | Содержание |
|----------|-----------|------------|
| [user-guide.md](user-guide.md) | Пользователь UI | Страница `/ranges`: фильтры, импорт, экспорт, KPI, ошибки и ограничения |
| [api-reference.md](api-reference.md) | Разработчик интеграций | REST API: endpoints, auth, фильтры, коды ошибок, rate limits |
| [import-and-datasets.md](import-and-datasets.md) | Dev / admin | Pipeline импорта, diff, snapshots, cron, модель данных |
| [deployment.md](deployment.md) | DevOps | Compose, Portainer, env, NPM, rate limits |
| [operations.md](operations.md) | Эксплуатация | Backup, мониторинг, troubleshooting, проверка версии |
| [security.md](security.md) | Security / ops | Perimeter-first, секреты, in-app rate limits, headers |
| [npm.md](npm.md) | DevOps | NGINX Proxy Manager: forward, SSL, ACL |
| [../infra/portainer/README.md](../infra/portainer/README.md) | DevOps | Краткий чеклист Portainer stack |

---

## Быстрые ссылки

- [CHANGELOG.md](../CHANGELOG.md) — история релизов
- [README.md](../README.md) — quick start
- Контракты TypeScript: `packages/shared/contracts/` (`dataset.schema.ts`, `filters.schema.ts`, `import.schema.ts`)

---

## Проверка версии на сервере

В production UI **не показывает** номер версии. Варианты:

1. `HEALTH_VERBOSE=1` в env контейнера app → `curl http://127.0.0.1:5555/api/health`
2. Тег образа GHCR / GitHub Release
3. Логи контейнера при старте (`APP_VERSION`)

Подробнее: [operations.md](operations.md).
