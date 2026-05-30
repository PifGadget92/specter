#!/system/bin/sh
set -e
MODDIR=${0%/*}
. "$MODDIR/../lib/common.sh"
. "$MODDIR/../lib/paths.sh"
. "$MODDIR/../lib/package_list.sh"
. "$MODDIR/../lib/config_env.sh"
. "$MODDIR/../lib/target_common.sh"

log "TARGET" "Start"

[ -d "$TRICKY_DIR" ] || die "Tricky Store data directory not found"

_tee_section && { exit 0; }

_count=0
MODULE_ROOT="${MODDIR%/features}"
TEMP_PKGS="$MODULE_ROOT/pkgs.txt"
_TMP_TARGET="${TARGET_TXT}.new.$$"
trap 'rm -f "$TEMP_PKGS" "${TEMP_PKGS}.filtered" "$_TMP_TARGET"' EXIT

_read_tee_status
_ensure_blacklist
_parse_customize

for entry in $FIXED_TARGETS; do
  echo "$entry" >> "$_TMP_TARGET"
  _count=$((_count + 1))
done

pkgs=$(pm list packages -3 2>/dev/null) || {
  log "TARGET" "Warning: Failed to list packages"
}
if [ -n "$pkgs" ]; then
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
    _compute_suffix "$pkg"
    echo "${pkg}${_suffix}" >> "$_TMP_TARGET"
    _count=$((_count + 1))
  done < "$TEMP_PKGS"
  rm -f "$TEMP_PKGS" "${TEMP_PKGS}.filtered"
fi

sort -u "$_TMP_TARGET" -o "$_TMP_TARGET"

rm -f "${TARGET_TXT}.bak"
[ -f "$TARGET_TXT" ] && cp "$TARGET_TXT" "${TARGET_TXT}.bak"
mv -f "$_TMP_TARGET" "$TARGET_TXT"

_count=$(wc -l < "$TARGET_TXT")
log "TARGET" "Wrote $_count entries to target.txt"
log "TARGET" "Finish"
exit 0
