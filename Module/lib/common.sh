log() { echo "$(date +%Y-%m-%d\ %H:%M:%S) [$1] $2"; }

die() { log "ERROR" "$1"; exit 1; }

download() {
    _dl_url="$1" _dl_oldpath="$PATH"
    PATH="/data/adb/magisk:/data/data/com.termux/files/usr/bin:$PATH"
    if command -v curl >/dev/null 2>&1; then
        curl --connect-timeout 10 -Ls "$_dl_url"
    else
        wget -T 10 -qO- "$_dl_url"
    fi
    PATH="$_dl_oldpath"
    unset _dl_url _dl_oldpath
}

check_network() {
  _cn_endpoint="https://clients3.google.com/generate_204"
  _cn_oldpath="$PATH"
  PATH="/data/adb/magisk:/data/data/com.termux/files/usr/bin:$PATH"
  if command -v curl >/dev/null 2>&1; then
    curl --connect-timeout 5 -sI "$_cn_endpoint" >/dev/null 2>&1 && PATH="$_cn_oldpath" && return 0
  fi
  if command -v wget >/dev/null 2>&1; then
    wget -T 5 --spider "$_cn_endpoint" >/dev/null 2>&1 && PATH="$_cn_oldpath" && return 0
  fi
  PATH="$_cn_oldpath"
  return 1
}

check_prop() {
    _cp_name=$1 _cp_expected=$2
    _cp_value=$(resetprop "$_cp_name")
    [ -z "$_cp_value" ] || [ "$_cp_value" = "$_cp_expected" ] || resetprop -n "$_cp_name" "$_cp_expected"
    unset _cp_name _cp_expected _cp_value
}

contains_check_prop() {
    _ccp_name=$1 _ccp_contains=$2 _ccp_newval=$3
    case "$(resetprop "$_ccp_name")" in
        *"$_ccp_contains"*) resetprop -n "$_ccp_name" "$_ccp_newval"; unset _ccp_name _ccp_contains _ccp_newval; return 0 ;;
    esac
    unset _ccp_name _ccp_contains _ccp_newval
    return 1
}

ensure_dir() { mkdir -p "$1" 2>/dev/null; }

_escape_json() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

apply_boot_hardening() {
  settings put global development_settings_enabled 0
  settings put global adb_enabled 0
  settings put global oem_unlock_allowed 0
  settings put global adb_wifi_enabled 0
  settings put global adb_wifi_port -1
  resetprop --delete persist.service.adb.enable 2>/dev/null || true
  resetprop --delete persist.service.debuggable 2>/dev/null || true
  resetprop -n persist.sys.developer_options 0
}

version_ge() {
  awk -v a="$1" -v b="$2" 'BEGIN {
    split(a,A,"."); split(b,B,".");
    for(i=1;i<=3;i++) {
      if(A[i]+0 > B[i]+0) { exit 0 }
      if(A[i]+0 < B[i]+0) { exit 1 }
    }
    exit 0
  }'
}

run_device_info() {
  for _rdi_root in "$@"; do
    [ -f "$_rdi_root/webroot/common/device-info.sh" ] && sh "$_rdi_root/webroot/common/device-info.sh" && return 0
  done
  for _rdi_p in \
    "/data/adb/modules_update/Specter/webroot/common/device-info.sh" \
    "/data/adb/modules/Specter/webroot/common/device-info.sh"; do
    [ -f "$_rdi_p" ] && sh "$_rdi_p" && return 0
  done
  return 1
}

_parse_serial() {
  _h="$1"
  case "$_h" in 30*) _h="${_h#30}" ;; *) return 1 ;; esac
  _l_hex="${_h:0:2}" _l_dec=$((16#$_l_hex))
  [ $_l_dec -ge 128 ] && _h="${_h:2 + ($_l_dec - 128) * 2}" || _h="${_h:2}"

  case "$_h" in 30*) _h="${_h#30}" ;; *) return 1 ;; esac
  _l_hex="${_h:0:2}" _l_dec=$((16#$_l_hex))
  [ $_l_dec -ge 128 ] && _h="${_h:2 + ($_l_dec - 128) * 2}" || _h="${_h:2}"

  case "$_h" in
    a0*)
      _ctx_len_hex="${_h:2:2}"
      _ctx_len=$((16#$_ctx_len_hex))
      _h="${_h:4 + _ctx_len * 2}"
      ;;
  esac

  case "$_h" in 02*) _h="${_h#02}" ;; *) return 1 ;; esac
  _l_hex="${_h:0:2}" _l_dec=$((16#$_l_hex))
  if [ $_l_dec -ge 128 ]; then
    _n=$((_l_dec - 128))
    _sl=$((16#${_h:2:_n * 2}))
    _serial_hex="${_h:2 + _n * 2:$_sl * 2}"
  else
    _serial_hex="${_h:2:$_l_dec * 2}"
  fi

  _serial=$(echo "$_serial_hex" | sed 's/^0*//')
  [ -z "$_serial" ] && _serial="0"
  return 0
}

decode_keybox_serial() {
  _b64=$(sed -n '/-----BEGIN CERTIFICATE-----/,/-----END CERTIFICATE-----/p' "$1" | head -20 | grep -v 'CERTIFICATE' | tr -d '\n')
  [ -z "$_b64" ] && return 1
  _hex=$(echo "$_b64" | base64 -d 2>/dev/null | od -v -tx1 | awk 'BEGIN{ORS=""} {for(i=2;i<=NF;i++) printf "%s", $i}')
  [ -z "$_hex" ] && return 1
  _parse_serial "$_hex" || return 1
  echo "$_serial"
}

apply_prop_hardening() {
  check_prop "ro.build.fingerprint" ""
  check_prop "ro.boot.vbmeta.device_state" "locked"
  check_prop "ro.boot.verifiedbootstate" "green"
  check_prop "ro.boot.flash.locked" "1"
  check_prop "ro.boot.veritymode" "enforcing"
  check_prop "ro.boot.warranty_bit" "0"
  check_prop "ro.warranty_bit" "0"
  check_prop "ro.debuggable" "0"
  check_prop "ro.secure" "1"
  check_prop "ro.adb.secure" "1"
  check_prop "ro.build.type" "user"
  check_prop "ro.build.tags" "release-keys"
  check_prop "ro.system.build.tags" "release-keys"
  check_prop "ro.vendor.build.tags" "release-keys"
  check_prop "ro.omni.build.type" "user"
  check_prop "ro.mediatek.platform" ""
  check_prop "ro.mediatek.chip_ver" ""
  check_prop "ro.mediatek.version" ""
  check_prop "ro.mediatek.model" ""
  check_prop "ro.vendor.mediatek.platform" ""
  check_prop "ro.vendor.mediatek.chip_ver" ""
  check_prop "persist.sys.fflag.override.settings_provider_model" ""
  check_prop "persist.sys.pixelprops.piunormal" ""
  check_prop "ro.boot.secboot" "enforcing"
}

find_kmInstallKeybox() {
  _fk_abi=$(getprop ro.product.cpu.abi 2>/dev/null || echo "arm64")
  _fk_lib_dir="/vendor/lib64"
  [ "$_fk_abi" != "arm64" ] && [ "$_fk_abi" != "x86_64" ] && _fk_lib_dir="/vendor/lib"
  _fk_bin=""
  for _fk_dir in "$_fk_lib_dir/hw" "$_fk_lib_dir"; do
    _fk_bin=$(find "$_fk_dir" -name "*kmInstallKeybox*" 2>/dev/null | head -1)
    [ -n "$_fk_bin" ] && break
  done
  echo "${_fk_bin:-}"
  unset _fk_abi _fk_lib_dir _fk_bin _fk_dir
}

resolve_module_root() {
  MODDIR="${0%/*}"
  if echo "$MODDIR" | grep -q "webroot/common"; then
    MODULE_ROOT="${MODDIR%/webroot/common}"
  else
    MODULE_ROOT="$MODDIR"
  fi
  echo "$MODULE_ROOT"
}
