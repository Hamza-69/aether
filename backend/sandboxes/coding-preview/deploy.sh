#!/usr/bin/env bash
# deploy-fly.sh — Deploy an Express + Prisma + SQLite app to Fly.io
# Run from your project root. No arguments needed.
# Requires: flyctl, node, npm

set -euo pipefail

VOLUME_NAME="data"
VOLUME_SIZE_GB=1

# ─── Helpers ───────────────────────────────────────────────────────────────────
info()    { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
success() { echo -e "\033[1;32m[OK]\033[0m    $*"; }
warn()    { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
die()     { echo -e "\033[1;31m[ERR]\033[0m   $*" >&2; exit 1; }

# ─── Pre-flight ────────────────────────────────────────────────────────────────
command -v fly  >/dev/null 2>&1 || die "flyctl not installed. https://fly.io/docs/hands-on/install-flyctl/"
command -v node >/dev/null 2>&1 || die "node not found."
command -v npm  >/dev/null 2>&1 || die "npm not found."

[[ -f "package.json" ]]         || die "No package.json found. Run from your project root."
[[ -f "prisma/schema.prisma" ]] || die "No prisma/schema.prisma found."

grep -q '"sqlite"' prisma/schema.prisma || die "schema.prisma does not use SQLite."

node -e "const p=require('./package.json'); process.exit(p.scripts?.start?0:1)" 2>/dev/null \
  || die "No 'start' script in package.json."

# ─── Auth ──────────────────────────────────────────────────────────────────────
fly auth whoami >/dev/null 2>&1 || { info "Logging in..."; fly auth login; }

# ─── Deps ──────────────────────────────────────────────────────────────────────
info "Installing dependencies..."
npm install

info "Generating Prisma client..."
npx prisma generate

# ─── First launch vs redeploy ──────────────────────────────────────────────────
if [[ -f "fly.toml" ]]; then
  info "fly.toml found — redeploying..."
  fly deploy --strategy rolling
  success "Redeployed."

else
  info "First deploy — running fly launch..."

  fly launch --no-deploy --copy-config --yes

  # ── Create litestream.yml (needed since fly always provisions Tigris) ─────
  if [[ ! -f "litestream.yml" ]]; then
    info "Creating litestream.yml..."
    cat > litestream.yml <<'LITESTREAM'
dbs:
  - path: /data/sqlite.db
    replicas:
      - url: s3://${BUCKET_NAME}/sqlite.db
        endpoint: ${AWS_ENDPOINT_URL_S3}
        access-key-id: ${AWS_ACCESS_KEY_ID}
        secret-access-key: ${AWS_SECRET_ACCESS_KEY}
        region: ${AWS_REGION}
LITESTREAM
    success "Created litestream.yml."
  fi

  # ── Patch Dockerfile: fix prisma copy path ──────────────────────────────
  if grep -q 'COPY prisma \.' Dockerfile 2>/dev/null; then
    warn "Fixing COPY prisma path in Dockerfile..."
    sed -i 's|COPY prisma \.|COPY prisma ./prisma|g' Dockerfile
    success "Fixed."
  fi

  # ── Volume ──────────────────────────────────────────────────────────────────
  APP_NAME=$(grep -E '^app' fly.toml | head -1 | tr -d "' \"" | cut -d'=' -f2 | tr -d '[:space:]')
  REGION=$(grep -E '^primary_region' fly.toml | head -1 | tr -d "' \"" | cut -d'=' -f2 | tr -d '[:space:]')
  if fly volumes list --app "$APP_NAME" 2>/dev/null | grep -q "$VOLUME_NAME"; then
    warn "Volume already exists. Skipping."
  else
    info "Creating volume in region '$REGION'..."
    fly volumes create "$VOLUME_NAME" --region "$REGION" --size "$VOLUME_SIZE_GB" --yes
    success "Volume created."
  fi

  # ── Secrets ─────────────────────────────────────────────────────────────────
  info "Setting DATABASE_URL..."
  fly secrets set DATABASE_URL="file:/data/sqlite.db"

  # ── Deploy ──────────────────────────────────────────────────────────────────
  info "Deploying..."
  fly deploy --strategy rolling
  success "Done."
fi