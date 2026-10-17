#!/system/bin/sh
set -e
MODDIR=${0%/*}

. "$MODDIR/../lib/common.sh"
. "$MODDIR/../lib/constants.sh"

log_i "HMA" "Starting HMA config install"

write_hma_config() {
  _src="$1"
  _pkg="$2"
  _app_dir="/data/user/0/$_pkg"
  _files_dir="$_app_dir/files"
  _ok=0

  rm -rf /data/misc/hide_my_applist 2>/dev/null || true

  if [ -d "$_app_dir" ]; then
    _uid_gid=$(stat -c '%u:%g' "$_app_dir" 2>/dev/null || true)
    mkdir -p "$_files_dir" 2>/dev/null || true
    if cat "$_src" > "$_files_dir/config.json" 2>/dev/null; then
      chmod 660 "$_files_dir/config.json" 2>/dev/null || true
      [ -n "$_uid_gid" ] && chown -R "$_uid_gid" "$_files_dir" 2>/dev/null || true
      restorecon -R "$_files_dir" 2>/dev/null || true
      _ok=1
    fi
  fi

  for _d in /data/misc/hide_my_applist_*; do
    [ -d "$_d" ] || continue
    if cat "$_src" > "$_d/config.json" 2>/dev/null; then
      chmod 644 "$_d/config.json" 2>/dev/null || true
      chown -R system:system "$_d" 2>/dev/null || true
      restorecon -R "$_d" 2>/dev/null || true
      _ok=1
    fi
  done

  [ "$_ok" = "1" ]
}

_installed_pkgs=$(pm list packages 2>/dev/null) || log_w "HMA" "Failed to list installed packages"

if echo "$_installed_pkgs" | grep -q "org.frknkrc44.hma_oss"; then
  _pkg="org.frknkrc44.hma_oss"
  _found="HMA-OSS"
elif echo "$_installed_pkgs" | grep -q "com.tsng.hidemyapplist"; then
  _pkg="com.tsng.hidemyapplist"
  _found="HMA"
elif echo "$_installed_pkgs" | grep -q "com.google.android.hmal"; then
  _pkg="com.google.android.hmal"
  _found="HMAL"
else
  log_w "HMA" "No HMA variant installed, skipping"
  unset _installed_pkgs
  log_i "HMA" "HMA config install complete"
  exit 0
fi

log_i "HMA" "Found $_found"

TEMP_FILE="/data/local/tmp/.specter_hma_config"

if check_network; then
  if download "$HMA_CONFIG_URL" "$TEMP_FILE" 2>/dev/null && [ -s "$TEMP_FILE" ]; then

    cp "$TEMP_FILE" "/sdcard/Download/hma-oss.json" 2>/dev/null || cp "$TEMP_FILE" "/sdcard/hma-oss.json" 2>/dev/null || true

    if write_hma_config "$TEMP_FILE" "$_pkg"; then
      log_i "HMA" "Config installed and permissions fixed for $_found"
    else
      log_e "HMA" "Config download succeeded but install failed"
    fi
    rm -f "$TEMP_FILE"
  else
    log_w "HMA" "Download returned empty"
  fi
fi

unset _installed_pkgs _pkg _found _src _app_dir _files_dir _ok _uid_gid _d TEMP_FILE
log_i "HMA" "HMA config install complete"
exit 0
