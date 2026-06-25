#!/system/bin/sh
set -e
MODDIR=${0%/*}
. "$MODDIR/../lib/common.sh"
. "$MODDIR/../lib/config_env.sh"
. "$MODDIR/../lib/paths.sh"

ZN_DATA_DIR="/data/adb/zygisksu"
ZN_MODULE_DIR="$MODULES_BASE/zygisksu"
[ ! -d "$ZN_MODULE_DIR" ] && ZN_MODULE_DIR="${MODULES_BASE}_update/zygisksu"

ZN_PROPFILE="$ZN_MODULE_DIR/module.prop"

if [ ! -f "$ZN_PROPFILE" ]; then
  log "ZYGISK_NEXT" "Error: Zygisk Next module not found at $ZN_MODULE_DIR"
  exit 1
fi

ZN_NAME=$(grep "^name=" "$ZN_PROPFILE" | cut -d= -f2)
log "ZYGISK_NEXT" "Detected: $ZN_NAME"

case "$ZN_NAME" in
  *Zygisk*Next*|*Zygisk-Next*|*ZygiskNext*)
    ;;
  *)
    log "ZYGISK_NEXT" "Error: Unknown module '$ZN_NAME'"
    exit 1
    ;;
esac

ensure_dir "$ZN_DATA_DIR"

echo -n 1 > "$ZN_DATA_DIR/denylist_enforce"
echo -n 1 > "$ZN_DATA_DIR/denylist_policy"

log "ZYGISK_NEXT" "Applied denylist config"
log "ZYGISK_NEXT" "Finish"
exit 0
