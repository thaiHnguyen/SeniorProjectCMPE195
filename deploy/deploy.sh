#!/usr/bin/env bash
# Deploy the backend on the Raspberry Pi.
#
# Called by .github/workflows/deploy.yml after CI passes on main, or by hand:
#     bash deploy/deploy.sh
#
# Steps:
#   1. refuse to run if the Pi's checkout has local edits to tracked files
#   2. fast-forward to the target commit (never force; stops if histories differ)
#   3. back up the database (safe while the backend is running)
#   4. pip install, only if requirements.txt changed
#   5. restart the backend service
#   6. wait for /api/health; if it doesn't come up, ROLL BACK code + database
#
# Settings (environment variables, all optional):
#   DEPLOY_DIR    repo folder on the Pi          (default: folder this script is in, ..)
#   TARGET_SHA    commit to deploy               (default: latest origin/$BRANCH)
#   BRANCH        branch to deploy               (default: main)
#   SERVICE_NAME  systemd service                (default: hydroponic)
#   RESTART_CMD   how to restart the backend     (default: sudo systemctl restart $SERVICE_NAME)
#   HEALTH_URL    health endpoint                (default: http://localhost:8000/api/health)
#   HEALTH_TIMEOUT seconds to wait for health    (default: 60)
#   PYTHON        python used for pip            (default: venv in DEPLOY_DIR, else python3)
#   KEEP_BACKUPS  database backups to keep       (default: 10)

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BRANCH="${BRANCH:-main}"
SERVICE_NAME="${SERVICE_NAME:-hydroponic}"
RESTART_CMD="${RESTART_CMD:-sudo systemctl restart ${SERVICE_NAME}}"
HEALTH_URL="${HEALTH_URL:-http://localhost:8000/api/health}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"

# Fail instead of waiting forever if git would ask for a username/password
export GIT_TERMINAL_PROMPT=0

log()  { echo "[deploy] $*"; }
fail() { echo "[deploy] ERROR: $*" >&2; exit 1; }

cd "$DEPLOY_DIR" || fail "DEPLOY_DIR not found: $DEPLOY_DIR"
[ -d .git ] || fail "$DEPLOY_DIR is not a git repository"

# Python: prefer the project's virtualenv
if [ -z "${PYTHON:-}" ]; then
    for candidate in .venv/bin/python venv/bin/python; do
        [ -x "$candidate" ] && PYTHON="$DEPLOY_DIR/$candidate" && break
    done
    PYTHON="${PYTHON:-python3}"
fi

# Database path: from .env if set, otherwise the backend's default
DB_PATH="./data/hydroponic.db"
if [ -f .env ]; then
    env_db="$(grep -E '^\s*DATABASE_PATH\s*=' .env | tail -n1 | cut -d= -f2- | tr -d '"'"'"' \r' || true)"
    [ -n "$env_db" ] && DB_PATH="$env_db"
fi

# 1. no local edits to tracked files 
# (.env, data/ and logs/ are git-ignored, so they don't count)
if ! git diff --quiet || ! git diff --cached --quiet; then
    git status --short
    fail "the Pi has uncommitted changes to tracked files. Commit or discard them first."
fi

# 2. move to the target commit 
PREV_SHA="$(git rev-parse HEAD)"
git fetch --quiet origin "$BRANCH" \
    || fail "git fetch failed. The Pi must be able to 'git pull' without typing a password (SSH key or saved token)."
TARGET_SHA="${TARGET_SHA:-$(git rev-parse "origin/$BRANCH")}"

if [ "$PREV_SHA" = "$TARGET_SHA" ]; then
    log "Already at ${TARGET_SHA:0:7}, nothing to deploy."
    exit 0
fi

git merge-base --is-ancestor "$TARGET_SHA" "origin/$BRANCH" \
    || fail "${TARGET_SHA:0:7} is not on origin/$BRANCH"

log "Deploying ${PREV_SHA:0:7} -> ${TARGET_SHA:0:7}"
git log --oneline "${PREV_SHA}..${TARGET_SHA}" | sed 's/^/[deploy]   /'

# Switch to the branch if the Pi was on something else; then fast-forward only
current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current_branch" != "$BRANCH" ]; then
    git switch --quiet "$BRANCH"
    PREV_SHA="$(git rev-parse HEAD)"
fi
git merge --ff-only --quiet "$TARGET_SHA" \
    || fail "can't fast-forward: the Pi's $BRANCH has commits that aren't on GitHub"

# 3. back up the database 
BACKUP=""
if [ -f "$DB_PATH" ]; then
    mkdir -p data/backups
    BACKUP="data/backups/hydroponic-$(date +%Y%m%d-%H%M%S)-${PREV_SHA:0:7}.db"
    # sqlite's backup API gives a consistent copy even while the backend writes to it
    "$PYTHON" - "$DB_PATH" "$BACKUP" <<'PY'
import sqlite3, sys
src, dst = sqlite3.connect(sys.argv[1]), sqlite3.connect(sys.argv[2])
with dst:
    src.backup(dst)
src.close(); dst.close()
PY
    log "Database backed up to $BACKUP"
    # keep only the newest $KEEP_BACKUPS backups (names are ours: no spaces/odd chars)
    # shellcheck disable=SC2012
    ls -1t data/backups/hydroponic-*.db 2>/dev/null | tail -n +"$((KEEP_BACKUPS + 1))" | xargs -r rm -- || true
else
    log "No database at $DB_PATH yet, skipping backup"
fi

# 4. dependencies (only when requirements.txt changed)
if ! git diff --quiet "$PREV_SHA" "$TARGET_SHA" -- requirements.txt; then
    log "requirements.txt changed, installing with $PYTHON"
    "$PYTHON" -m pip install --quiet -r requirements.txt
fi

# 5 + 6. restart and health check, with rollback
wait_healthy() {
    local waited=0
    while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
        if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
            return 0
        fi
        sleep 2
        waited=$((waited + 2))
    done
    return 1
}

rollback() {
    log "Health check failed after ${HEALTH_TIMEOUT}s. Rolling back to ${PREV_SHA:0:7}"
    git reset --quiet --hard "$PREV_SHA"
    if [ -n "$BACKUP" ]; then
        cp "$BACKUP" "$DB_PATH"
        log "Database restored from $BACKUP"
    fi
    if ! git diff --quiet "$TARGET_SHA" "$PREV_SHA" -- requirements.txt; then
        "$PYTHON" -m pip install --quiet -r requirements.txt || true
    fi
    eval "$RESTART_CMD" || log "restart command returned an error"
    if wait_healthy; then
        fail "deploy of ${TARGET_SHA:0:7} failed; rolled back to ${PREV_SHA:0:7} (backend is healthy)"
    else
        fail "deploy failed AND the rollback isn't healthy. Check: sudo journalctl -u $SERVICE_NAME -n 80"
    fi
}

log "Restarting backend: $RESTART_CMD"

# Don't exit on a failed restart: the health check below decides, and rolls back
eval "$RESTART_CMD" || log "restart command returned an error"

if wait_healthy; then
    log "Healthy at ${TARGET_SHA:0:7}: $(curl -fsS --max-time 3 "$HEALTH_URL")"
else
    rollback
fi