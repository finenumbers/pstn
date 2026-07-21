# Сертификаты НУЦ Минцифры (Russian Trusted CA)

Корневой и промежуточный CA для TLS-сайтов на сертификатах Минцифры России, в том числе `opendata.digital.gov.ru`.

| Файл | CN | Действует до |
|------|-----|--------------|
| `russian_trusted_root_ca.crt` | Russian Trusted Root CA | 2032-02-27 |
| `russian_trusted_sub_ca.crt` | Russian Trusted Sub CA | 2027-03-06 |

## Источник

- Официальная страница: https://www.gosuslugi.ru/crt
- PEM-файлы (скачаны 2026-07-21):
  - https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt
  - https://gu-st.ru/content/lending/russian_trusted_sub_ca_pem.crt

## Использование в PSTN

Файлы копируются в Docker-образ app (`Dockerfile`, stage `runner`) и добавляются в системное хранилище Alpine через `update-ca-certificates`. Node.js `fetch` при import CSV использует `/etc/ssl/certs/ca-certificates.crt`.

## Обновление

При ротации корней Минцифры:

1. Скачать актуальные `.crt` с gosuslugi.ru/crt
2. Заменить файлы в этой директории
3. Выпустить новый релиз образа и redeploy stack
