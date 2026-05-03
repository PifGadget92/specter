#!/system/bin/sh
. /data/adb/modules/Specter/lib/common.sh 2>/dev/null
MODULE_ROOT=$(resolve_module_root)
SCRIPT_DIR="$MODULE_ROOT/webroot/common"
FW_DIR="$SCRIPT_DIR/FixWidevineL1"

if [ ! -d "$FW_DIR" ]; then
  echo "[WIDEVINE_L1] Error: FixWidevineL1 directory not found"
  exit 1
fi

cp -r "$FW_DIR"/* /data/local/tmp/ || { echo "[WIDEVINE_L1] Error: Copy failed"; exit 1; }

[ -f /data/local/tmp/FixWidevineL1.sh ] || { echo "[WIDEVINE_L1] Error: Script not copied"; exit 1; }

chmod 755 /data/local/tmp/FixWidevineL1.sh 2>/dev/null
chmod 755 /data/local/tmp/attestation 2>/dev/null

sh /data/local/tmp/FixWidevineL1.sh || echo "[WIDEVINE_L1] Warning: Script exited non-zero"
exit 0
