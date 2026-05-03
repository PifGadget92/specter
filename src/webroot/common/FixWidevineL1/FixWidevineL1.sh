#!/system/bin/sh
. /data/adb/modules/Specter/lib/common.sh 2>/dev/null

_abi=$(getprop ro.product.cpu.abi 2>/dev/null)
case "$_abi" in
  arm64|x86_64) _lib="/vendor/lib64/hw" ;;
  *)            _lib="/vendor/lib/hw" ;;
esac

KM_BIN=$(find_kmInstallKeybox)

if [ -n "$KM_BIN" ]; then
  LD_LIBRARY_PATH="$_lib" "$KM_BIN" /data/local/tmp/attestation attestation true
else
  echo "[WIDEVINE_L1] Warning: KmInstallKeybox not found (non-Qualcomm device?)"
fi

unset KM_BIN _abi _lib
