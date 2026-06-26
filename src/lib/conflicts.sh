# shellcheck shell=sh
CONFLICT_BACKUP_FILE="$SPECTER_DIR/conflict_backups.txt"

_conflict_detect() {
  case "$1" in
    integritybox) [ -d "$MODULES_BASE/playintegrityfix" ] && [ -d "/data/adb/Box-Brain" ] ;;
    *) [ -d "$MODULES_BASE/$1" ] || [ -d "${MODULES_BASE}_update/$1" ] || [ -d "$MODULES_BASE/.$1" ] || [ -d "${MODULES_BASE}_update/.$1" ] ;;
  esac
}

_conflict_rename_bak() {
  [ -f "$1" ] && [ ! -f "$1.bak" ] && mv "$1" "$1.bak" 2>/dev/null && grep -qxF "$1" "$CONFLICT_BACKUP_FILE" 2>/dev/null || echo "$1" >> "$CONFLICT_BACKUP_FILE" 2>/dev/null || true
}

_conflict_restore_bak() {
  [ -f "$1.bak" ] && mv "$1.bak" "$1" 2>/dev/null || true
}

_conflict_uninstall() {
  _cu_id="$1" _cu_name="$2"
  _cu_dir="$MODULES_BASE/$_cu_id"
  [ "$_cu_id" = "integritybox" ] && _cu_dir="$MODULES_BASE/playintegrityfix"
  _cu_dir_upd="${MODULES_BASE}_update/${_cu_dir##*/}"
  for _cu_path in "$_cu_dir" "$_cu_dir_upd"; do
    [ -d "$_cu_path" ] || continue
    [ -f "$_cu_path/uninstall.sh" ] && sh "$_cu_path/uninstall.sh" 2>/dev/null || true
    rm -rf "$_cu_path"
  done
  [ "$_cu_id" = "integritybox" ] && [ -d "/data/adb/Box-Brain" ] && rm -rf "/data/adb/Box-Brain"
  sed -i "\|/$_cu_id/|d" "$CONFLICT_BACKUP_FILE" 2>/dev/null || true
}

_conflict_toggle_key() {
  case "$1" in target|security_patch|gms|keybox|pif) printf 'toggle_action_%s' "$1" ;; *) printf 'toggle_%s' "$1" ;; esac
}

_feature_should_run() {
  _fsr_feature="$1" _fsr_default="${2:-1}"
  [ "$(cfg_get "$(_conflict_toggle_key "$_fsr_feature")" "$_fsr_default")" != "0" ] || return 1
}

_resolve_aggressive() {
  case "$1" in
    Yurikey|integritybox|tsupport-advance|sensitive_props)
      _conflict_uninstall "$1" "$2"
      log_i "CONFLICT" "$2: 100% overlap, uninstalled" ;;
    *)
      log_i "CONFLICT" "$2: 100% overlap, disabled, Specter covers all" ;;
  esac
  cfg_set "conflict_$1" "priority_specter"
}

_resolve_passive() {
  if [ ! -f "$CONFIG_DIR/conflict_$1.val" ]; then
    cfg_set "conflict_$1" "priority_module"
    log_i "CONFLICT" "$2: partial overlap, defaulting to Module priority"
  fi
}

_apply_scripts() {
  _as_scripts="$1" _as_choice="$2"
  _as_old_ifs="$IFS"; IFS=','
  for _as_script in $_as_scripts; do
    [ -z "$_as_script" ] && continue
    [ "$_as_choice" = "priority_module" ] && _conflict_restore_bak "$_as_script" || _conflict_rename_bak "$_as_script"
  done
  IFS="$_as_old_ifs"
}

resolve_conflicts() {
  ensure_dir "$SPECTER_DIR"
  touch "$CONFLICT_BACKUP_FILE" 2>/dev/null || true

  # Clean stale configs for undetected modules
  for _rc_id in zygisk_nohello tsupport-advance treat_wheel sensitive_props Yurikey integritybox brene TA_utl TA_enhanced; do
    _conflict_detect "$_rc_id" && continue
    [ -f "$CONFIG_DIR/conflict_$_rc_id.val" ] || continue
    rm -f "$CONFIG_DIR/conflict_$_rc_id.val"
    sed -i "\|/$_rc_id/|d" "$CONFLICT_BACKUP_FILE" 2>/dev/null || true
  done

  for _rc_id in zygisk_nohello tsupport-advance treat_wheel sensitive_props Yurikey integritybox brene TA_utl TA_enhanced; do
    _conflict_detect "$_rc_id" || continue
    case "$_rc_id" in
      tsupport-advance|sensitive_props|Yurikey|integritybox|TA_utl|TA_enhanced)
        _resolve_aggressive "$_rc_id" "$_rc_id" ;;
      zygisk_nohello|treat_wheel|brene)
        _resolve_passive "$_rc_id" "$_rc_id" ;;
    esac
  done
}

_conflict_claimed() {
  case "$1" in
    boot_hardening)
      _conflict_detect "integritybox" && [ "$(cfg_get conflict_integritybox priority_specter)" = "priority_specter" ] && return 1
      _conflict_detect "Yurikey" && [ "$(cfg_get conflict_Yurikey priority_specter)" = "priority_specter" ] && return 1
      _conflict_detect "tsupport-advance" && [ "$(cfg_get conflict_tsupport-advance priority_specter)" = "priority_specter" ] && return 1
      _conflict_detect "sensitive_props" && [ "$(cfg_get conflict_sensitive_props priority_specter)" = "priority_specter" ] && return 1
      _conflict_detect "TA_utl" && [ "$(cfg_get conflict_TA_utl priority_specter)" = "priority_specter" ] && return 1
      _conflict_detect "TA_enhanced" && [ "$(cfg_get conflict_TA_enhanced priority_specter)" = "priority_specter" ] && return 1
      _conflict_detect "brene" && [ "$(cfg_get conflict_brene priority_module)" = "priority_module" ] && return 0
      _conflict_detect "zygisk_nohello" && [ "$(cfg_get conflict_zygisk_nohello priority_module)" = "priority_module" ] && return 0
      ;;
    prop_handler)
      _conflict_detect "brene" && [ "$(cfg_get conflict_brene priority_module)" = "priority_module" ] && return 0
      _conflict_detect "treat_wheel" && [ "$(cfg_get conflict_treat_wheel priority_module)" = "priority_module" ] && return 0
      ;;
    boot_hash)
      _conflict_detect "brene" && [ "$(cfg_get conflict_brene priority_module)" = "priority_module" ] && return 0
      _conflict_detect "TA_utl" && [ "$(cfg_get conflict_TA_utl priority_module)" = "priority_module" ] && return 0
      _conflict_detect "TA_enhanced" && [ "$(cfg_get conflict_TA_enhanced priority_module)" = "priority_module" ] && return 0
      ;;
    security_patch)
      _conflict_detect "tsupport-advance" && [ "$(cfg_get conflict_tsupport-advance priority_specter)" = "priority_specter" ] && return 1
      _conflict_detect "TA_enhanced" && [ "$(cfg_get conflict_TA_enhanced priority_specter)" = "priority_specter" ] && return 1
      _conflict_detect "Yurikey" && [ "$(cfg_get conflict_Yurikey priority_specter)" = "priority_specter" ] && return 1
      _conflict_detect "integritybox" && [ "$(cfg_get conflict_integritybox priority_specter)" = "priority_specter" ] && return 1
      ;;
    target)
      _conflict_detect "tsupport-advance" && [ "$(cfg_get conflict_tsupport-advance priority_specter)" = "priority_specter" ] && return 1
      _conflict_detect "integritybox" && [ "$(cfg_get conflict_integritybox priority_specter)" = "priority_specter" ] && return 1
      ;;
    keybox)
      _conflict_detect "TA_enhanced" && [ "$(cfg_get conflict_TA_enhanced priority_specter)" = "priority_specter" ] && return 1
      ;;
  esac
  return 1
}

conflict_status_json() {
  _cs_first=1
  printf '['
  for _cs_id in zygisk_nohello treat_wheel brene; do
    _conflict_detect "$_cs_id" || continue
    [ "$_cs_first" -eq 0 ] && printf ',' || _cs_first=0
    _cs_choice=$(cfg_get "conflict_$_cs_id" "priority_specter")
    printf '{"key":"%s","friendlyName":"%s","detected":true,"prioritySpecter":%s,"type":"%s","features":"%s"}' \
      "$_cs_id" "$_cs_id" "$([ "$_cs_choice" = "priority_specter" ] && echo true || echo false)" "passive" ""
  done
  printf ']'
}

conflict_set_choice() {
  case "$2" in priority_specter|priority_module) ;; *) return 1 ;; esac
  cfg_set "conflict_$1" "$2"
}

conflict_resolve_for_feature() {
  _crf_toggle_key="$(_conflict_toggle_key "$1")"
  for _crf_id in zygisk_nohello tsupport-advance treat_wheel sensitive_props Yurikey integritybox brene TA_utl TA_enhanced; do
    _conflict_detect "$_crf_id" || continue
    [ "$(cfg_get "conflict_$_crf_id" priority_specter)" = "priority_module" ] || continue
    cfg_set "conflict_$_crf_id" "priority_specter"
  done
  cfg_set "$_crf_toggle_key" "1"
}
