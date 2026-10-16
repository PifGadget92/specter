#!/system/bin/sh
set -e
MODDIR=${0%/*}

. "$MODDIR/../lib/common.sh"
. "$MODDIR/../lib/constants.sh"

log_i "HMA" "Starting HMA config install"

run_root() {
  if [ "$(id -u)" -eq 0 ]; then
    sh -c "$1" 2>/dev/null
  else
    su -c "$1" 2>/dev/null
  fi
}

write_hma_config() {
  _src="$1"
  _pkg="$2"
  _app_dir="/data/user/0/$_pkg"
  _files_dir="$_app_dir/files"
  _ok=0

  run_root "rm -rf /data/misc/hide_my_applist" || true

  if run_root "[ -d '$_app_dir' ]"; then
    _uid_gid=$(run_root "stat -c '%u:%g' '$_app_dir'" || true)
    if run_root "mkdir -p '$_files_dir' && cat '$_src' > '$_files_dir/config.json' && chmod 660 '$_files_dir/config.json'"; then
      [ -n "$_uid_gid" ] && run_root "chown -R '$_uid_gid' '$_files_dir'" || true
      run_root "restorecon -R '$_files_dir'" || true
      _ok=1
    fi
  fi

  _misc_dirs=$(run_root "ls -d /data/misc/hide_my_applist_* 2>/dev/null" || true)
  if [ -n "$_misc_dirs" ]; then
    for _d in $_misc_dirs; do
      if run_root "[ -d '$_d' ] && cat '$_src' > '$_d/config.json' && chmod 644 '$_d/config.json'"; then
        _ok=1
      fi
    done
    run_root "chown system:system -R /data/misc/hide_my_applist*" || true
    run_root "restorecon -R /data/misc/hide_my_applist*" || true
  fi

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

unset _installed_pkgs _pkg _found _src _app_dir _files_dir _ok _uid_gid _misc_dirs _d TEMP_FILE
log_i "HMA" "HMA config install complete"
exit 0
