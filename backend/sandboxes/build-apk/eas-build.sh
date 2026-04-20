#!/bin/bash
# eas-build.sh — trigger an EAS Android APK build using a local keystore.
# Run from the frontend project root. Requires:
#   - EXPO_TOKEN in env
#   - $1 = keystore password (used for both storePassword and keyPassword)
#   - my-upload-key.keystore present in cwd (PKCS12, alias "release")
# Writes credentials.json + eas.json, ensures the Expo project is linked,
# then runs `eas build` blocking and prints the final build JSON to stdout.

set -e

PASS=$1
if [ -z "$PASS" ]; then
  echo "Usage: ./eas-build.sh <keystore_password>" >&2
  exit 1
fi

if [ -z "$EXPO_TOKEN" ]; then
  echo "EXPO_TOKEN env var is required" >&2
  exit 1
fi

if [ ! -f "my-upload-key.keystore" ]; then
  echo "my-upload-key.keystore not found in $(pwd)" >&2
  exit 1
fi

# Write local credentials so EAS signs with our keystore instead of managing
# one on its side. keyAlias must match the alias baked into the keystore by
# sandboxes/generate-keystore/generate-keystore.sh (currently "release").
cat > credentials.json <<EOF
{
  "android": {
    "keystore": {
      "keystorePath": "my-upload-key.keystore",
      "keystorePassword": "${PASS}",
      "keyAlias": "release",
      "keyPassword": "${PASS}"
    }
  }
}
EOF

# Profile "production-apk" — buildType=apk + credentialsSource=local so EAS
# uses credentials.json above. Overwrite any eas.json shipped with the tar to
# keep the profile shape predictable.
cat > eas.json <<'EOF'
{
  "cli": {
    "version": ">= 0.0.0",
    "appVersionSource": "local"
  },
  "build": {
    "production-apk": {
      "android": {
        "buildType": "apk",
        "credentialsSource": "local",
        "gradleCommand": ":app:assembleRelease -PenableProguardInReleaseBuilds=false -PenableShrinkResourcesInReleaseBuilds=false"
      },
      "env": {
        "EXPO_NO_MINIFY": "1"
      }
    }
  }
}
EOF

# EAS refuses to build outside a git repo (uses it to determine project root
# and track the build). Initialize one if the restored tar doesn't include
# .git — our frontend tars are git ls-files based, so .git is never shipped.
git config --global user.email "aether@example.com"
git config --global user.name "aether"
git config --global init.defaultBranch main
# Frontend dir was unpacked by the sandbox's default user; this script runs
# as root, so git's dubious-ownership check fires. Whitelist the path.
git config --global --add safe.directory "$(pwd)"
if [ ! -d ".git" ]; then
  git init -q
fi
git add -A
git commit -q -m "aether export" --allow-empty || true

# Ensure the project is linked to an Expo account (creates one if missing).
# --non-interactive prevents prompts; if already initialized this no-ops.
eas init --force --non-interactive 2>&1 || true

# Kick off the build non-blocking — EAS does the heavy work remotely and the
# CLI's long-poll connection was getting killed by e2b's network proxy on
# long builds. We poll `eas build:view` separately instead.
# stdout is a JSON build object with the build id; caller parses it.
eas build \
  --platform android \
  --profile production-apk \
  --non-interactive \
  --no-wait \
  --json
