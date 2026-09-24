#!/usr/bin/env bash
set -euo pipefail

V1_URL="${V1_URL:-http://127.0.0.1:8080}"
LEGACY_URL="${LEGACY_URL:-http://127.0.0.1:3000}"

check_pair() {
  local path="$1"
  local v1 legacy
  v1=$(curl -fsS "$V1_URL/api/v1$path")
  legacy=$(curl -fsS "$LEGACY_URL/api$path")
  python3 - "$v1" "$legacy" "$path" <<'PY'
import json, sys
v1, legacy, path = map(json.loads, sys.argv[1:])
if isinstance(v1, list) != isinstance(legacy, list):
    raise SystemExit(f"shape mismatch: {path}")
if isinstance(v1, list) and v1 and legacy and not set(legacy[0]).issubset(set(v1[0])):
    raise SystemExit(f"legacy fields missing in v1: {path}")
print(f"PASS {path}")
PY
}

for endpoint in /statuses /car-models /customer-types /insurances /body-parts /employees /reports /part-orders /part-inbound /part-outbound /quotas; do
  check_pair "$endpoint"
done
echo "API contract smoke passed"
