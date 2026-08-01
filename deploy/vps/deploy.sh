#!/usr/bin/env sh
set -eu

ROOT=${ROOT:-/opt/0xda-market-web-app/environments/development}
RELEASE_SHA=${RELEASE_SHA:?RELEASE_SHA is required}
WEB_APP_PORT=${WEB_APP_PORT:-10002}
RELEASE_DIR="$ROOT/releases/$RELEASE_SHA"
CURRENT_LINK="$ROOT/current"
PREVIOUS_TARGET=""

if [ ! -d "$RELEASE_DIR" ]; then
  echo "release directory does not exist: $RELEASE_DIR" >&2
  exit 1
fi

mkdir -p "$ROOT/releases" "$ROOT/shared"
if [ -L "$CURRENT_LINK" ]; then
  PREVIOUS_TARGET=$(readlink "$CURRENT_LINK")
fi

cd "$RELEASE_DIR/deploy/vps"
RELEASE_SHA="$RELEASE_SHA" WEB_APP_PORT="$WEB_APP_PORT" docker compose build --pull
RELEASE_SHA="$RELEASE_SHA" WEB_APP_PORT="$WEB_APP_PORT" docker compose up -d --remove-orphans

healthy=0
attempt=1
while [ "$attempt" -le 30 ]; do
  if curl --fail --silent "http://127.0.0.1:$WEB_APP_PORT/healthz" >/dev/null; then
    healthy=1
    break
  fi
  sleep 2
  attempt=$((attempt + 1))
done

if [ "$healthy" -ne 1 ]; then
  echo "new release failed health gate" >&2
  RELEASE_SHA="$RELEASE_SHA" WEB_APP_PORT="$WEB_APP_PORT" docker compose logs --no-color --tail=100 >&2 || true
  RELEASE_SHA="$RELEASE_SHA" WEB_APP_PORT="$WEB_APP_PORT" docker compose down || true

  if [ -n "$PREVIOUS_TARGET" ] && [ -d "$PREVIOUS_TARGET/deploy/vps" ]; then
    previous_sha=$(basename "$PREVIOUS_TARGET")
    cd "$PREVIOUS_TARGET/deploy/vps"
    RELEASE_SHA="$previous_sha" WEB_APP_PORT="$WEB_APP_PORT" docker compose up -d --remove-orphans
  fi
  exit 1
fi

ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

find "$ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -nr \
  | awk 'NR > 5 {print $2}' \
  | xargs -r rm -rf

echo "deployed $RELEASE_SHA on 127.0.0.1:$WEB_APP_PORT"
