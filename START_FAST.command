#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "===== RIZENIC FAST UI V7 SMOOTH + SPINNER + ENTER SEARCH / ENV SAFE START ====="
echo "Project: $PROJECT_DIR"

is_valid_env() {
  local f="$1"
  [ -f "$f" ] || return 1
  grep -q '^DATABASE_URL=' "$f" || return 1
  if grep -Eq '\[ยูสเซอร์เนม\]|\[รหัสลับ\]|\[ลิงก์เซิร์ฟเวอร์ของนาย\]|YOUR_|CHANGE_ME|example\.com' "$f"; then
    return 1
  fi
  local value
  value="$(grep '^DATABASE_URL=' "$f" | head -1 | cut -d= -f2-)"
  [ -n "$value" ] || return 1
  case "$value" in
    postgresql://*|postgres://*) return 0 ;;
    *) return 1 ;;
  esac
}

if ! is_valid_env "$PROJECT_DIR/.env"; then
  if is_valid_env "$PROJECT_DIR/.env.example"; then
    echo "===== CREATE LOCAL .env FROM .env.example ====="
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    chmod 600 "$PROJECT_DIR/.env" 2>/dev/null || true
    echo "✅ สร้าง .env local ใหม่จาก .env.example"
  else
    echo "===== FIND WORKING .env ====="
    FOUND=""

    CANDIDATES=(
      "$HOME/Desktop/rizenic-backend-panich/.env"
      "$HOME/Desktop/rizenic-backend-panich-git-final/.env"
      "$HOME/Desktop/rizenic-backend-feature-rizenic-v1-backend/.env"
      "$HOME/Desktop/rizenic-backend-panich-sa-loader-fix/.env"
      "$HOME/Desktop/rizenic-backend-main/.env"
    )

    while IFS= read -r f; do
      CANDIDATES+=("$f")
    done < <(find "$HOME/Desktop" -maxdepth 3 -type f -name '.env' -path '*rizenic*' 2>/dev/null | sort -u)

    for f in "${CANDIDATES[@]}"; do
      [ "$f" = "$PROJECT_DIR/.env" ] && continue
      if is_valid_env "$f"; then
        FOUND="$f"
        break
      fi
    done

    if [ -z "$FOUND" ]; then
      echo "❌ ไม่พบ .env ที่ใช้งานได้ และ .env.example ไม่พร้อม"
      exit 1
    fi

    cp "$FOUND" "$PROJECT_DIR/.env"
    chmod 600 "$PROJECT_DIR/.env" 2>/dev/null || true
    echo "✅ คัดลอก .env จาก: $(dirname "$FOUND")"
  fi
fi

# Local PostgreSQL on this Mac is non-SSL. Keep remote envs unchanged.
if grep -Eq '^DATABASE_URL=postgres(?:ql)?://[^@]*@(localhost|127\.0\.0\.1)(:|/)' "$PROJECT_DIR/.env"; then
  if grep -q '^PG_SSL_MODE=' "$PROJECT_DIR/.env"; then
    sed -i '' 's/^PG_SSL_MODE=.*/PG_SSL_MODE=disable/' "$PROJECT_DIR/.env"
  else
    echo 'PG_SSL_MODE=disable' >> "$PROJECT_DIR/.env"
  fi
fi

# Refuse to start if the env is still a placeholder.
if ! is_valid_env "$PROJECT_DIR/.env"; then
  echo "❌ .env ปัจจุบันยังไม่ใช่ DATABASE_URL จริง จึงไม่เริ่ม server"
  exit 1
fi

echo "===== CHECK FILES ====="
test -f app.js
test -f public/index.html
test -f public/jobs_table.html
echo "✅ app.js / index.html / jobs_table.html ครบ"

if [ ! -d node_modules ]; then
  echo "===== INSTALL ====="
  npm ci
fi

echo "===== TEST ====="
node --test test/*.test.js

echo "===== STOP OLD PORT 3000 ====="
OLD_PID="$(lsof -tiTCP:3000 -sTCP:LISTEN 2>/dev/null || true)"
if [ -n "$OLD_PID" ]; then
  kill -9 $OLD_PID 2>/dev/null || true
  sleep 1
fi

echo "===== START SERVER ====="
nohup env PORT=3000 node --env-file=.env app.js > "$PROJECT_DIR/server.log" 2>&1 &
SERVER_PID=$!
sleep 2

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "❌ Server start ไม่สำเร็จ"
  cat "$PROJECT_DIR/server.log"
  exit 1
fi

INDEX_STATUS="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/index.html || true)"
JOBS_STATUS="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/jobs_table.html || true)"

echo "index.html      = $INDEX_STATUS"
echo "jobs_table.html = $JOBS_STATUS"

if [ "$INDEX_STATUS" != "200" ] || [ "$JOBS_STATUS" != "200" ]; then
  echo "❌ Static route check ไม่ผ่าน"
  cat "$PROJECT_DIR/server.log"
  exit 1
fi

echo "✅ Server พร้อมใช้งาน"
echo "เปิด: http://localhost:3000/index.html"
open "http://localhost:3000/index.html" 2>/dev/null || true
