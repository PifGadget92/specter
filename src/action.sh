#!/system/bin/sh
# shellcheck shell=bash
MODDIR=${0%/*}

case "$(readlink /proc/$$/exe 2>/dev/null)" in
  *busybox) set +o standalone; unset ASH_STANDALONE ;;
esac

. "$MODDIR/lib/common.sh"
. "$MODDIR/lib/config_env.sh"

ACTION_LOG="$SPECTER_DIR/log/action.log"
ensure_dir "$SPECTER_DIR/log" 2>/dev/null
log_rotate "$ACTION_LOG"

{
  log "ACTION" "Running full integrity pipeline"

  [ "$(cfg_get toggle_action_gms 1)" != "0" ] && sh "$MODDIR/features/kill_play_store.sh" || true
  [ "$(cfg_get toggle_action_target 1)" != "0" ] && ! _conflict_claimed "target" && sh "$MODDIR/features/target.sh" --merge || true
  [ "$(cfg_get toggle_action_security_patch 1)" != "0" ] && ! _conflict_claimed "security_patch" && sh "$MODDIR/features/security_patch.sh" || true
  [ "$(cfg_get toggle_action_keybox 1)" != "0" ] && sh "$MODDIR/features/keybox.sh" || true
  if [ "$(cfg_get toggle_action_pif 1)" != "0" ]; then
    _pif_name=$(_pif_prop) || _pif_name=""
    if [ -z "$_pif_name" ]; then
      if [ -f "$SPECTER_DIR/pif_reported" ]; then
        log "ACTION" "PIF not found — first boot suppress (pif_reported token consumed)"
        rm -f "$SPECTER_DIR/pif_reported"
      elif [ -t 1 ]; then
        log "ACTION" "PIF not found. Press Volume UP to install, Volume DOWN to skip..."
        _ap_key=$(timeout 10 getevent -l 2>/dev/null | grep -oE "KEY_VOLUME(UP|DOWN)" | head -1)
        if [ "$_ap_key" = "KEY_VOLUMEUP" ]; then
          install_module_from_github "KOWX712/PlayIntegrityFix" "Play Integrity Fix" || \
            log "ACTION" "PIF install failed"
          log "ACTION" "PIF installed — reboot required before running autopif"
          _pif_installed=1
        else
          log "ACTION" "PIF install skipped by user"
        fi
        unset _ap_key
      else
        log "ACTION" "PIF not found — auto-install skipped (run from terminal or install manually)"
      fi
    fi
    unset _pif_name
    if [ -z "$_pif_installed" ] && [ -f "$MODDIR/features/pif.sh" ]; then
      sh "$MODDIR/features/pif.sh" || true
    fi
  fi

  run_device_info "$MODDIR"
  sh "$MODDIR/features/keybox_info.sh" >/dev/null 2>&1 || true

  [ -f "$MODDIR/module.prop.bak" ] && cp "$MODDIR/module.prop.bak" "$MODDIR/module.prop"
  . "$MODDIR/lib/desc.sh"
  refresh_module_description

  log "ACTION" "Full integrity pipeline completed"
} 2>&1 | tee -a "$ACTION_LOG"

[ "${0##*/}" = "action.sh" ] && exit 0 || return 0
