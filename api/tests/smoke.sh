#!/usr/bin/env bash
# ===========================================================================
# Maintenance Dispatch API — endpoint smoke test
#
# Exercises the auth + work-order flow against a running API using only curl.
# It verifies status codes, session cookies, and CSRF enforcement.
#
# Usage:
#   BASE=http://localhost:8000 USER=admin PASS='ChangeMe123!' ./tests/smoke.sh
#
# Prereqs: a running PHP API (e.g. `php -S localhost:8000 -t public_html`
# routed to api/, or a deployed Bluehost staging URL) with the schema imported
# and at least one user. Exits non-zero on the first failed assertion.
# ===========================================================================
set -u

BASE="${BASE:-http://localhost:8000}"
USER="${USER:-admin}"
PASS="${PASS:-ChangeMe123!}"
JAR="$(mktemp)"
PASS_COUNT=0
FAIL_COUNT=0

check() { # check <label> <expected_code> <actual_code>
  if [ "$2" = "$3" ]; then
    echo "  PASS  $1 ($3)"; PASS_COUNT=$((PASS_COUNT+1))
  else
    echo "  FAIL  $1 (expected $2, got $3)"; FAIL_COUNT=$((FAIL_COUNT+1))
  fi
}

code() { tail -n1; }  # last line = http_code from -w

echo "== Maintenance Dispatch API smoke test =="
echo "Base: $BASE"

# 1) Unauthenticated access is rejected
c=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/work-orders")
check "GET /work-orders unauthenticated -> 401" 401 "$c"

# 2) Health is public
c=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/health")
check "GET /health -> 200" 200 "$c"

# 3) Login (stores session cookie)
LOGIN=$(curl -s -c "$JAR" -w '\n%{http_code}' -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" "$BASE/api/auth/login")
c=$(printf '%s' "$LOGIN" | code)
check "POST /auth/login -> 200" 200 "$c"
CSRF=$(printf '%s' "$LOGIN" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')

# 4) Authenticated /me works with the cookie
c=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' "$BASE/api/auth/me")
check "GET /auth/me authenticated -> 200" 200 "$c"

# 5) CSRF enforced: POST without token is rejected
c=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
  -d '{"description":"x"}' "$BASE/api/work-orders")
check "POST /work-orders without CSRF -> 419" 419 "$c"

# 6) Create work order WITH CSRF token + cookie
c=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"description":"Smoke test WO","priority":"low"}' "$BASE/api/work-orders")
check "POST /work-orders with CSRF -> 201" 201 "$c"

# 7) List work orders
c=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' "$BASE/api/work-orders")
check "GET /work-orders authenticated -> 200" 200 "$c"

# 8) Bad login is rejected
c=$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USER\",\"password\":\"definitely-wrong\"}" "$BASE/api/auth/login")
check "POST /auth/login bad password -> 401" 401 "$c"

rm -f "$JAR"
echo "== Done: $PASS_COUNT passed, $FAIL_COUNT failed =="
[ "$FAIL_COUNT" -eq 0 ]
