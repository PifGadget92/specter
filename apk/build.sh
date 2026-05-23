#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MODULE_SRC="$PROJECT_ROOT/src/apk"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"

echo "=== Building release APK ==="
cd "$SCRIPT_DIR"
gradle assembleRelease

APK="$SCRIPT_DIR/app/build/outputs/apk/release/app-release.apk"
[ -f "$APK" ] && echo "APK: $APK ($(stat -c%s "$APK") bytes)" || { echo "Build failed"; exit 1; }

echo "=== Copying APK to module source ==="
mkdir -p "$MODULE_SRC"
cp "$APK" "$MODULE_SRC/specter.apk"
echo "Copied to $MODULE_SRC/specter.apk"

echo "=== Done ==="
echo "Now run 'npm run build' from $PROJECT_ROOT to bundle it"
