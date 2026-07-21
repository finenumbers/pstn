#!/bin/sh
set -eu

apk add --no-cache curl

# busybox crond may not pass Docker env vars into cron jobs
printenv | grep -v '^_' > /etc/environment

APP_PORT="${APP_PORT:-5555}"
IMPORT_SECRET="${IMPORT_SECRET:?IMPORT_SECRET is required for scheduler}"

# Bake env at container start so cron jobs work even without env inheritance
cat > /usr/local/bin/pstn-cron-import.sh << SCRIPT
#!/bin/sh
set -a
[ -f /etc/environment ] && . /etc/environment
set +a
code=\$(curl -s -o /tmp/pstn-import.json -w "%{http_code}" \\
  -X POST "http://app:${APP_PORT}/api/import" \\
  -H "X-Import-Secret: ${IMPORT_SECRET}" \\
  -H "Content-Type: application/json" \\
  -d '{"triggeredBy":"cron"}')
echo "[pstn-cron] HTTP \${code} \$(cat /tmp/pstn-import.json 2>/dev/null)"
if [ "\$code" -lt 200 ] || [ "\$code" -ge 300 ]; then
  exit 1
fi
SCRIPT

chmod +x /usr/local/bin/pstn-cron-import.sh

printf '0 18 * * * /usr/local/bin/pstn-cron-import.sh\n' > /etc/crontabs/root

echo "[pstn-cron] scheduler ready; daily import at 18:00 ${CRON_TZ:-UTC}"

exec crond -f -l 8
