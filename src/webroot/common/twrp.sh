#!/system/bin/sh
. /data/adb/modules/Specter/lib/common.sh 2>/dev/null
MODULE_ROOT=$(resolve_module_root)
sh "$MODULE_ROOT/features/twrp.sh"
