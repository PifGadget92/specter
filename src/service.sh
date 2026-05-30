#!/system/bin/sh
set -e
MODDIR=${0%/*}
. "$MODDIR/lib/common.sh"
. "$MODDIR/lib/package_list.sh"
. "$MODDIR/lib/paths.sh"
. "$MODDIR/lib/config_env.sh"
detect_root_solution
export ROOT_SOL

log "SERVICE" "Setting early boot properties"

# Early boot props (immediate, no wait, re-applied by boot_core.sh after boot completed)
if [ "$(cfg_get toggle_prop_handler 1)" != "0" ]; then
  [ "$(cfg_get boot_state_props 1)" != "0" ] && apply_boot_props
  [ "$(cfg_get spoof_build_props 1)" != "0" ] && spoof_build_props
fi

log "SERVICE" "Early boot properties set"

# KernelSU / APatch: boot-completed.sh handles the rest
[ "$KSU" = "true" ] && {
  log "SERVICE" "KernelSU/APatch detected, boot-completed.sh handles hardening"
  exit 0
}

# Magisk: poll sys.boot_completed, then run unified boot core
log "SERVICE" "Magisk detected, waiting for boot completion"
while [ "$(getprop sys.boot_completed)" != "1" ]; do
  sleep 1
done
log "SERVICE" "Boot completed, sourcing unified boot core"

. "$MODDIR/lib/boot_core.sh"
