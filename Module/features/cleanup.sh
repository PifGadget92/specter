#!/system/bin/sh
MODDIR=${0%/*}
. "$MODDIR/../lib/common.sh"
. "$MODDIR/../lib/paths.sh"
. "$MODDIR/../lib/package_list.sh"

log "CLEANUP" "Start"

while [ "$(getprop sys.boot_completed)" != "1" ]; do
  sleep 1
done

_rm() { [ -n "$1" ] && rm -rf "$1" 2>/dev/null; }

for _pkg in $DETECTOR_APPS; do
  _rm "/storage/emulated/0/Android/data/$_pkg"
  _rm "/storage/emulated/0/Android/obb/$_pkg"
  _rm "/storage/emulated/0/Android/media/$_pkg"
done

_rm "/storage/emulated/0/meow_detector.log"
_rm "/storage/emulated/0/keybox_status.json"

for _pkg in $TOOL_APPS; do
  _rm "/storage/emulated/0/Android/data/$_pkg"
done
_rm "/storage/emulated/0/MT2"
_rm "/storage/emulated/0/bin.mt.termux"
_rm "/storage/emulated/0/com.termux"
_rm "/storage/emulated/0/xzr.hkf"
_rm "/storage/emulated/0/Download/WechatXposed"
_rm "/storage/emulated/0/WechatXposed"
_rm "/storage/emulated/0/Android/naki"
_rm "/storage/emulated/0/最新版隐藏配置.json"
_rm "/storage/emulated/0/rlgg"
_rm "/storage/emulated/legacy"
_rm "/storage/emulated/com.luckyzyx.luckytool"

for _pkg in $REMOTE_CONTROL_APPS; do
  _rm "/storage/emulated/0/Android/data/$_pkg"
done
_rm "/storage/emulated/0/.anydesk"
_rm "/storage/emulated/0/anydesk"
_rm "/storage/emulated/0/.rustdesk"
_rm "/storage/emulated/0/rustdesk"
_rm "/storage/emulated/0/.vysor"
_rm "/storage/emulated/0/Vysor"

# Remove specific known-bad persistent prop files, NOT the entire directory
_rm "/data/property/persistent_properties" 2>/dev/null || true

_rm "/data/local/tmp/shizuku"
_rm "/data/local/tmp/shizuku_starter"
_rm "/data/local/tmp/byyang"
_rm "/data/local/tmp/HyperCeiler"
_rm "/data/local/tmp/luckys"
_rm "/data/local/tmp/input_devices"
_rm "/data/local/tmp/resetprop"

_rm "/data/system/graphicsstats"
_rm "/data/system/package_cache"
_rm "/data/system/NoActive"
_rm "/data/system/Freezer"
_rm "/data/system/junge"
_rm "/data/swap_config.conf"

_rm "/dev/memcg/scene_idle"
_rm "/dev/memcg/scene_active"
_rm "/dev/scene"
_rm "/dev/cpuset/scene-daemon"

pm clear com.juom >/dev/null 2>&1 || true

apply_prop_hardening

check_prop "sys.usb.adb.disabled" "1"
check_prop "persist.sys.usb.config" "mtp"
check_prop "sys.usb.config" "mtp"
check_prop "sys.usb.state" "mtp"
check_prop "service.adb.root" "0"
check_prop "vendor.boot.verifiedbootstate" "green"
check_prop "vendor.boot.vbmeta.device_state" "locked"
check_prop "ro.secureboot.lockstate" "locked"
check_prop "ro.boot.realme.lockstate" "1"
check_prop "ro.oem_unlock_supported" "0"
check_prop "sys.oem_unlock_allowed" "0"
check_prop "ro.kernel.qemu" "0"
check_prop "ro.boot.qemu" "0"
check_prop "ro.hardware.virtual_device" "0"

resetprop -p --delete persist.service.adb.enable 2>/dev/null || true
resetprop -p --delete persist.service.debuggable 2>/dev/null || true
resetprop -p --delete persist.zygote.app_data_isolation 2>/dev/null || true
resetprop -p --delete persist.hyperceiler.log.level 2>/dev/null || true
resetprop -p --delete persist.com.luckyzyx.luckytool.log.level 2>/dev/null || true
resetprop -p --delete persist.com.luckyzyx.luckytool.debug 2>/dev/null || true
resetprop -p --delete persist.com.luckyzyx.luckytool.enable 2>/dev/null || true
resetprop -p --delete persist.sys.developer_options 2>/dev/null || true
resetprop -p --delete persist.sys.dev_mode 2>/dev/null || true

resetprop -n persist.sys.dev_mode 0
resetprop -n persist.sys.debuggable 0

apply_boot_hardening

if [ "$(getenforce 2>/dev/null)" = "Enforcing" ]; then
  resetprop ro.boot.selinux enforcing
  resetprop ro.build.selinux 1
fi

unset _rm _pkg
log "CLEANUP" "Finish"
exit 0
