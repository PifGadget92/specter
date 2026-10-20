#!/system/bin/sh
set -e
MODDIR=${0%/*}
. "$MODDIR/../lib/common.sh"

_HMA_ROOT="${MODDIR%/*}"
_HMA_TMP_BASE=$(_hma_tmp_base)
_HMA_TMP="$_HMA_TMP_BASE/specter_hma.$$"
mkdir -p "$_HMA_TMP" 2>/dev/null || true
trap 'rm -rf "$_HMA_TMP" 2>/dev/null || true' EXIT

log_i "HMA" "Starting HMA-OSS config generation"

if ! _hma_installed | grep -Fxq "$HMAOSS_PKG"; then
  log_w "HMA" "HMA-OSS not installed, skipping"
  exit 0
fi

_hma_dir=$(_hma_find_dir)
if [ -z "$_hma_dir" ]; then
  log_w "HMA" "HMA-OSS data dir missing — open HMA-OSS once (or reboot), then re-run"
  exit 0
fi

_hma_list=$(_hma_list_path "$_HMA_ROOT")
if [ -z "$_hma_list" ]; then
  log_e "HMA" "hide list not found ($HMAOSS_HIDE_LIST)"
  exit 1
fi

_hma_inst="$_HMA_TMP/installed"
_hma_apps="$_HMA_TMP/hidden-apps"
_hma_user="$_HMA_TMP/user-apps"
_hma_scope="$_HMA_TMP/scope-entries"
_hma_default="$_HMA_TMP/default.json"
_hma_base="$_HMA_TMP/base.json"
_hma_merged="$_HMA_TMP/merged.json"

_hma_installed > "$_hma_inst"
_hma_filter_hide_list "$_hma_list" "$_hma_inst" "$_hma_apps"
if [ "$(cfg_get toggle_hma_target_user_apps 1)" = "1" ]; then
  _hma_user_apps > "$_hma_user"
  _hma_build_scope "$_hma_user" "$HMAOSS_TEMPLATE" "$_hma_scope"
else
  : > "$_hma_scope"
fi
_hma_appconfig_json "$HMAOSS_TEMPLATE" > "$_hma_default"

_hma_cfg="$_hma_dir/config.json"
if [ -f "$_hma_cfg" ]; then
  _hma_copy_config "$_hma_cfg" "$_hma_base" || : > "$_hma_base"
else
  : > "$_hma_base"
fi

if ! _hma_merge_config "$_hma_base" "$_hma_apps" "$_hma_scope" "$_hma_default" "$_hma_merged"; then
  log_e "HMA" "config merge failed, existing config left untouched"
  exit 1
fi

_hma_backup "$_hma_cfg"
if ! _hma_install_config "$_hma_merged" "$_hma_cfg" "$_hma_dir"; then
  log_e "HMA" "failed to install config (root required)"
  exit 1
fi

_hma_hidden_n=$(wc -l < "$_hma_apps" | tr -d ' ')
_hma_added_n=$(wc -l < "$_hma_scope" | tr -d ' ')
log_i "HMA" "Hidden apps: $_hma_hidden_n | scope additions: $_hma_added_n"

if [ "$SPECTER_FIRST_BOOT" = "1" ] || [ "${SPECTER_HMA_NO_UI_RELOAD:-}" = "1" ]; then
  log_i "HMA" "Config written; reboot or long-press HMA-OSS Home to apply"
elif [ "$(cfg_get toggle_hma_live_reload 1)" = "1" ] && _hma_request_reload "$_HMA_TMP"; then
  log_i "HMA" "Live reload requested in HMA-OSS"
else
  log_w "HMA" "Config written; reboot or long-press HMA-OSS Home to apply"
fi
exit 0
