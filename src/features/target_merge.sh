#!/system/bin/sh
set -e
MODDIR=${0%/*}
. "$MODDIR/../lib/common.sh"
. "$MODDIR/../lib/paths.sh"
. "$MODDIR/../lib/package_list.sh"
. "$MODDIR/../lib/config_env.sh"

log "TARGET" "Start (merge)"

[ -d "$TRICKY_DIR" ] || die "Tricky Store data directory not found"

if _is_teesimulator; then
    log "TARGET" "TEESimulator — generating locked.xml section"
    _cust="/sdcard/Specter/customize.txt"
    if [ -f "$_cust" ] && [ "$(head -1 "$_cust" 2>/dev/null)" != "#disable" ]; then
      _locked=$(grep -v '^#' "$_cust" | sed 's/[!?]$//' 2>/dev/null || echo "")
      if [ -n "$_locked" ]; then
        [ -f "$TARGET_TXT" ] && cp "$TARGET_TXT" "${TARGET_TXT}.bak"
        _tmp=$(mktemp 2>/dev/null || echo "/data/local/tmp/.specter_tee_$$")
        _locked_f="/data/local/tmp/.specter_locked.$$"
        printf '%s\n' $_locked > "$_locked_f"
        if [ -f "$TARGET_TXT" ] && [ -s "$TARGET_TXT" ]; then
          sed '/^\[/d' "$TARGET_TXT" | grep -Fvxf "$_locked_f" > "$_tmp"
        fi
        rm -f "$_locked_f"
        printf '%s\n' '[locked.xml]' $_locked >> "$_tmp"
        [ -s "$_tmp" ] && mv -f "$_tmp" "$TARGET_TXT" || rm -f "$_tmp"
        unset _tmp
      fi
      unset _locked
    fi
    unset _cust
    log "TARGET" "Finish (TEESimulator)"
    exit 0
fi

_count=0
_added=0
MODULE_ROOT="${MODDIR%/features}"
TEMP_PKGS="$MODULE_ROOT/pkgs.txt"
_TMP_TARGET="${TARGET_TXT}.new.$$"
_TMP_EXIST="${TARGET_TXT}.exist.$$"
trap 'rm -f "$TEMP_PKGS" "${TEMP_PKGS}.filtered" "$_TMP_TARGET" "$_TMP_EXIST"' EXIT

teeBroken="false"
[ -f "$TEE_STATUS" ] && teeBroken=$(grep -E '^(teeBroken|tee_broken)=' "$TEE_STATUS" 2>/dev/null | cut -d= -f2 || echo "false")
log "TARGET" "TEE status: teeBroken=$teeBroken"

BLACKLIST="$SPECTER_DIR/blacklist.txt"
if [ ! -f "$BLACKLIST" ]; then
  log "TARGET" "Creating default blacklist from DETECTOR_APPS"
  ensure_dir "$SPECTER_DIR"
  {
    for _pkg in $DETECTOR_APPS $BLACKLIST_EXTRA; do
      echo "$_pkg"
    done
  } > "$BLACKLIST"
  log "TARGET" "Default blacklist created"
fi

_customize="/sdcard/Specter/customize.txt"
_customize_mode=""
if [ -f "$_customize" ]; then
  _first=$(head -1 "$_customize" 2>/dev/null || echo "")
  case "$_first" in
    "!") _customize_mode="force_all" ;;
    "?") _customize_mode="condition_all" ;;
    "#disable") _customize_mode="disabled" ;;
    *) _customize_mode="selective" ;;
  esac
  log "TARGET" "customize.txt mode: $_customize_mode"
fi

_normalize_pkg() {
  _line="$1"
  case "$_line" in
    *!) _line=${_line%!} ;;
    *\?) _line=${_line%\?} ;;
  esac
  printf '%s' "$_line"
}

_record_existing() {
  [ -f "$_TMP_EXIST" ] || : > "$_TMP_EXIST"
  tr -d '\r' < "$TARGET_TXT" | while IFS= read -r _line || [ -n "$_line" ]; do
    [ -z "$_line" ] && continue
    case "$_line" in
      \[*\]) continue ;;
    esac
    _base=$(_normalize_pkg "$_line")
    [ -n "$_base" ] && printf '%s\n' "$_base" >> "$_TMP_EXIST"
  done
}

_append_missing() {
  _line="$1"
  _base=$(_normalize_pkg "$_line")
  [ -z "$_base" ] && return 0
  if ! grep -Fxq "$_base" "$_TMP_EXIST" 2>/dev/null; then
    printf '%s\n' "$_line" >> "$_TMP_TARGET"
    printf '%s\n' "$_base" >> "$_TMP_EXIST"
    _added=$((_added + 1))
  fi
  _count=$((_count + 1))
}

if [ -f "$TARGET_TXT" ] && [ -s "$TARGET_TXT" ]; then
  cp "$TARGET_TXT" "$_TMP_TARGET"
  _record_existing
else
  : > "$_TMP_TARGET"
  : > "$_TMP_EXIST"
fi

for entry in $FIXED_TARGETS; do
  _append_missing "$entry"
done

for flag in "-3" "-s"; do
  pkgs=$(pm list packages "$flag" 2>/dev/null) || {
    log "TARGET" "Warning: Failed to list packages (flag $flag)"
    continue
  }
  [ -z "$pkgs" ] && continue
  echo "$pkgs" | cut -d ":" -f 2 > "$TEMP_PKGS"
  if [ -f "$SPECTER_DIR/blacklist_enabled" ] && [ -s "$BLACKLIST" ]; then
    if grep -Fvxf "$BLACKLIST" "$TEMP_PKGS" > "${TEMP_PKGS}.filtered" 2>/dev/null; then
      mv "${TEMP_PKGS}.filtered" "$TEMP_PKGS"
    else
      log "TARGET" "Warning: Blacklist filtering failed"
    fi
  fi

  while read -r pkg; do
    [ -z "$pkg" ] && continue
    _suffix="" _custom_matched=false
    if [ "$_customize_mode" = "selective" ]; then
      _match=$(grep -E "^${pkg}[!?]?$" "$_customize" 2>/dev/null | head -1)
      if [ -n "$_match" ]; then
        _custom_matched=true
        case "$_match" in
          *!) _suffix="!" ;;
          *\?)
            if [ "$teeBroken" = "true" ]; then
              _suffix=""
            else
              _suffix="?"
            fi
            ;;
          *) _suffix="" ;;
        esac
      fi
    fi
    if [ "$_customize_mode" = "force_all" ]; then
      _suffix="!"
    elif [ "$_customize_mode" = "condition_all" ]; then
      _suffix="?"
    fi
    if [ -z "$_suffix" ] && [ "$_custom_matched" != "true" ]; then
      [ "$teeBroken" = "true" ] && _suffix="?"
    fi
    _append_missing "${pkg}${_suffix}"
  done < "$TEMP_PKGS"
  rm -f "$TEMP_PKGS" "${TEMP_PKGS}.filtered"
done

rm -f "${TARGET_TXT}.bak"
[ -f "$TARGET_TXT" ] && cp "$TARGET_TXT" "${TARGET_TXT}.bak"
mv -f "$_TMP_TARGET" "$TARGET_TXT"

log "TARGET" "Checked $_count entries, added $_added"
sh "$MODDIR/../refresh_desc.sh" >/dev/null 2>&1 || true
log "TARGET" "Finish (merge)"
exit 0
