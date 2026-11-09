#!/bin/bash
# Visitor report from the Analytics Engine dataset that worker/visits.js writes.
#
#   ./worker/report.sh                visits by network organization, last 30 days
#   ./worker/report.sh 7              same, last 7 days
#   ./worker/report.sh 30 pages       visits by page
#   ./worker/report.sh 30 referrers   visits by referring site
#   ./worker/report.sh 30 days        visits per day
#
# Credentials: export CF_ACCOUNT_ID and CF_API_TOKEN, or put the two export lines in
# ~/.config/musaorak-visits.env (sourced below if present). See README.md for where
# to find the account ID and how to create a token with Account Analytics: Read.
set -euo pipefail

ENV_FILE="$HOME/.config/musaorak-visits.env"
[ -f "$ENV_FILE" ] && . "$ENV_FILE"
: "${CF_ACCOUNT_ID:?not set; see the comment at the top of $0}"
: "${CF_API_TOKEN:?not set; see the comment at the top of $0}"

DAYS="${1:-30}"
VIEW="${2:-orgs}"
case "$DAYS" in ''|*[!0-9]*) echo "days must be a whole number, got '$DAYS'" >&2; exit 1 ;; esac

ORDER_BY="visits DESC"
case "$VIEW" in
  orgs)      DIMS="blob1 AS organization, blob3 AS country, blob5 AS city"
             GROUP_BY="organization, country, city" ;;
  pages)     DIMS="blob6 AS page";         GROUP_BY="page" ;;
  referrers) DIMS="blob7 AS referrer";     GROUP_BY="referrer" ;;
  days)      DIMS="formatDateTime(toStartOfDay(timestamp), '%Y-%m-%d') AS day"
             GROUP_BY="day"; ORDER_BY="day" ;;
  *) echo "unknown view '$VIEW' (use orgs, pages, referrers or days)" >&2; exit 1 ;;
esac

SQL="SELECT $DIMS, sum(_sample_interval) AS visits, max(timestamp) AS last_seen
FROM visits
WHERE timestamp > now() - INTERVAL '$DAYS' DAY
GROUP BY $GROUP_BY
ORDER BY $ORDER_BY
LIMIT 200"

curl -sS --fail-with-body \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/analytics_engine/sql" \
  -H "Authorization: Bearer $CF_API_TOKEN" --data-binary "$SQL" |
python3 -c '
import json, sys
raw = sys.stdin.read()
try:
    res = json.loads(raw)
except ValueError:
    sys.exit(raw.strip() or "empty response from the API")
cols = [m["name"] for m in res["meta"]]
rows = [[str(r.get(c, "")) for c in cols] for r in res["data"]]
if not rows:
    sys.exit("no visits recorded in this period")
widths = [max([len(c)] + [len(r[i]) for r in rows]) for i, c in enumerate(cols)]
fmt = "  ".join("{:<%d}" % w for w in widths)
print(fmt.format(*cols))
print(fmt.format(*["-" * w for w in widths]))
for r in rows:
    print(fmt.format(*r))
'
