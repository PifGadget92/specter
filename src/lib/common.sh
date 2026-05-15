# shellcheck shell=sh
ROOT_SOL=""

log() { echo "[$1] $2"; }

die() { log "ERROR" "$1"; exit 1; }

download() {
    _dl_url="$1" _dl_output="$2" _dl_sha256="$3" _dl_oldpath="$PATH"
    PATH="/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:/data/data/com.termux/files/usr/bin:$PATH"
    _dl_tmp="" _dl_code=1 _dl_try=0

    if [ -z "$_dl_output" ]; then
        _dl_tmp=$(mktemp 2>/dev/null || echo "/data/local/tmp/.specter_dl_${$}_$(date +%s)")
        _dl_output="$_dl_tmp"
    fi

    for _dl_try in 1 2 3; do
        if busybox wget -T 10 --no-check-certificate -qO "$_dl_output" "$_dl_url" 2>/dev/null; then
            _dl_code=0 && break
        fi
        if command -v curl >/dev/null 2>&1 && curl --version >/dev/null 2>&1; then
            curl --connect-timeout 10 -Ls -o "$_dl_output" "$_dl_url" 2>/dev/null && _dl_code=0 && break
        fi
        sleep 1
    done

    if [ "$_dl_code" -eq 0 ] && [ -n "$_dl_sha256" ]; then
        _dl_sum=$(sha256sum "$_dl_output" 2>/dev/null | cut -d' ' -f1)
        if [ "$_dl_sum" != "$_dl_sha256" ]; then
            rm -f "$_dl_output"
            PATH="$_dl_oldpath"
            unset _dl_url _dl_output _dl_sha256 _dl_oldpath _dl_tmp _dl_code _dl_try _dl_sum
            return 1
        fi
    fi

    if [ -n "$_dl_tmp" ] && [ "$_dl_code" -eq 0 ]; then
        cat "$_dl_tmp"
        rm -f "$_dl_tmp"
    fi

    PATH="$_dl_oldpath"
    unset _dl_url _dl_output _dl_sha256 _dl_oldpath _dl_tmp _dl_code _dl_try _dl_sum
    return $_dl_code
}

check_network() {
    _cn_oldpath="$PATH"
    PATH="/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:/data/data/com.termux/files/usr/bin:$PATH"
    _cn_dns="" _cn_endpoint="https://clients3.google.com/generate_204" _cn_retry=0

    for _cn_dns in "1.1.1.1" "8.8.8.8" "9.9.9.9"; do
        ping -c1 -W2 "$_cn_dns" >/dev/null 2>&1 && PATH="$_cn_oldpath" && unset _cn_oldpath _cn_dns _cn_endpoint _cn_retry && return 0
    done

    for _cn_retry in 1 2 3; do
        if busybox wget -T 5 -qO /dev/null "$_cn_endpoint" 2>/dev/null; then
            PATH="$_cn_oldpath" && unset _cn_oldpath _cn_dns _cn_endpoint _cn_retry && return 0
        fi
        if command -v curl >/dev/null 2>&1 && curl --version >/dev/null 2>&1; then
            curl --connect-timeout 5 -sI "$_cn_endpoint" >/dev/null 2>&1 && PATH="$_cn_oldpath" && unset _cn_oldpath _cn_dns _cn_endpoint _cn_retry && return 0
        fi
        sleep "$_cn_retry"
    done

    PATH="$_cn_oldpath"
    unset _cn_oldpath _cn_dns _cn_endpoint _cn_retry
    return 1
}

check_prop() {
    _cp_name=$1 _cp_expected=$2
    _cp_value=$(resetprop "$_cp_name" 2>/dev/null || echo "")
    [ -z "$_cp_value" ] || [ "$_cp_value" = "$_cp_expected" ] || resetprop -n "$_cp_name" "$_cp_expected" 2>/dev/null || true
    unset _cp_name _cp_expected _cp_value
}

detect_root_solution() {

    if [ -f "/data/adb/ksud" ]; then
        ROOT_SOL="kernelsu"
    elif [ -f "/data/adb/apd" ]; then
        ROOT_SOL="apatch"
    elif [ -f "/data/adb/magisk" ]; then
        ROOT_SOL="magisk"
    else
        ROOT_SOL="legacy"
    fi

    if [ "$ROOT_SOL" = "legacy" ] && command -v resetprop >/dev/null 2>&1; then
        ROOT_SOL="magisk"
    fi

}

SPECTER_DIR="/data/adb/Specter"
GMS_PROPS_FILE="/data/system/gms_certified_props.json"
GOOGLE_REVOCATION_URL="${GOOGLE_REVOCATION_URL:-https://android.googleapis.com/attestation/status?encrypted=0}"
PERSIST_RESTORE_FILE="$SPECTER_DIR/persist_backup.txt"

sp_try() {
  _st_name="$1"
  if [ $# -eq 2 ]; then
    _st_expected="$2"
    _st_current=$(resetprop "$_st_name" 2>/dev/null || echo "")
    [ -z "$_st_current" ] || [ "$_st_current" = "$_st_expected" ] && return 0
  elif [ $# -ge 3 ]; then
    _st_needle="$2" _st_value="$3"
    _st_current=$(resetprop "$_st_name" 2>/dev/null || echo "")
    case "$_st_current" in *"$_st_needle"*) ;; *) return 1 ;; esac
    _st_expected="$_st_value"
  else
    return 1
  fi
  case "$ROOT_SOL" in
    legacy) setprop "$_st_name" "$_st_expected" 2>/dev/null || true ;;
    *) resetprop -n "$_st_name" "$_st_expected" 2>/dev/null || true ;;
  esac
  unset _st_name _st_expected _st_current _st_needle _st_value
  return 0
}

sp_persist() {
  _sp_name="$1" _sp_value="$2"
  case "$ROOT_SOL" in
    legacy) setprop "$_sp_name" "$_sp_value" 2>/dev/null || true ;;
    *) resetprop -n -p "$_sp_name" "$_sp_value" 2>/dev/null || true ;;
  esac
  _sp_restore=$(resetprop "$_sp_name" 2>/dev/null || echo "")
  if [ -n "$_sp_restore" ]; then
    ensure_dir "$SPECTER_DIR"
    if ! grep -qsF "|$_sp_name|" "$PERSIST_RESTORE_FILE" 2>/dev/null; then
      echo "restore|$_sp_name|$_sp_restore" >> "$PERSIST_RESTORE_FILE" 2>/dev/null || true
    fi
  fi
  unset _sp_name _sp_value _sp_restore
}

hide_recovery_folders() {
    [ -f "$SPECTER_DIR/twrp" ] && return 0

    _hrf_backup="/data/adb/recovery_backups"
    _hrf_random="" _hrf_subdirs=0 _hrf_path=""

    for _hrf_folder in TWRP OrangeFox FOX PBRP PitchBlack Recovery; do
        _hrf_path="/sdcard/$_hrf_folder"
        [ ! -d "$_hrf_path" ] && continue

        if [ -f "$_hrf_path/.twrps" ]; then
            rm -f "$_hrf_path/.twrps" 2>/dev/null || {
                _hrf_random=$(head /dev/urandom 2>/dev/null | tr -dc A-Za-z0-9 | head -c 12)
                [ -z "$_hrf_random" ] && _hrf_random="recovery_${$}"
                mv "$_hrf_path" "/sdcard/$_hrf_random" 2>/dev/null
                continue
            }
        fi

        _hrf_path_recurse="$_hrf_path"
        _hrf_subdirs=$(find "$_hrf_path_recurse" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)

        if [ "$_hrf_subdirs" -gt 0 ]; then
            mkdir -p "$_hrf_backup" 2>/dev/null
            mv "$_hrf_path" "$_hrf_backup/" 2>/dev/null
        else
            rm -rf "$_hrf_path" 2>/dev/null
        fi
    done

    unset _hrf_backup _hrf_random _hrf_subdirs _hrf_path _hrf_path_recurse _hrf_folder
}

apply_prop_hardening() {
    check_prop "ro.boot.vbmeta.device_state" "locked"
    check_prop "vendor.boot.vbmeta.device_state" "locked"
    check_prop "ro.boot.verifiedbootstate" "green"
    check_prop "vendor.boot.verifiedbootstate" "green"
    check_prop "ro.boot.flash.locked" "1"
    check_prop "ro.boot.veritymode" "enforcing"
    check_prop "ro.boot.warranty_bit" "0"
    check_prop "ro.warranty_bit" "0"
    check_prop "ro.boot.realme.lockstate" "1"
    check_prop "ro.boot.realmebootstate" "green"
    check_prop "ro.boot.veritymode.managed" "yes"
    check_prop "ro.secureboot.lockstate" "locked"
    check_prop "ro.debuggable" "0"
    check_prop "ro.force.debuggable" "0"
    check_prop "ro.secure" "1"
    check_prop "ro.adb.secure" "1"
    check_prop "ro.build.type" "user"
    check_prop "ro.build.tags" "release-keys"
    check_prop "ro.system.build.tags" "release-keys"
    check_prop "ro.vendor.build.tags" "release-keys"
    check_prop "sys.oem_unlock_allowed" "0"
    check_prop "ro.oem_unlock_supported" "0"
    check_prop "sys.usb.config" "mtp"
    check_prop "sys.usb.state" "mtp"
    check_prop "sys.usb.adb.disabled" "1"
    check_prop "persist.sys.usb.config" "mtp"
    check_prop "service.adb.root" "0"
    check_prop "ro.kernel.qemu" "0"
    check_prop "ro.boot.qemu" "0"
    check_prop "ro.hardware.virtual_device" "0"
    check_prop "ro.boot.selinux" "enforcing"
    check_prop "ro.crypto.state" "encrypted"
    sp_try "ro.boot.warranty_bit" "0"
    sp_try "ro.vendor.boot.warranty_bit" "0"
    sp_try "ro.vendor.warranty_bit" "0"
    sp_try "ro.warranty_bit" "0"
    sp_try "ro.is_ever_orange" "0"

    while IFS= read -r _aph_prop; do
        [ -z "$_aph_prop" ] && continue
        sp_try "$_aph_prop" "user"
    done <<PROPS
$(resetprop 2>/dev/null | grep -oE 'ro.*\.build\.type' | grep -v 'ro.build.type' || true)
PROPS

    while IFS= read -r _aph_prop; do
        [ -z "$_aph_prop" ] && continue
        sp_try "$_aph_prop" "release-keys"
    done <<PROPS
$(resetprop 2>/dev/null | grep -oE 'ro.*\.build\.tags' | grep -v 'ro.build.tags' || true)
PROPS

    [ "$(getprop ro.boot.selinux 2>/dev/null)" = "enforcing" ] && check_prop "ro.build.selinux" "1"
    return 0
}

disable_dev_options() {
  settings put global development_settings_enabled 0
  resetprop -n persist.sys.developer_options 0
}

apply_boot_hardening() {
  settings put global adb_enabled 0
  settings put global oem_unlock_allowed 0
  settings put global adb_wifi_enabled 0
  settings put global adb_wifi_port -1
  resetprop --delete persist.service.adb.enable 2>/dev/null || true
  resetprop --delete persist.service.debuggable 2>/dev/null || true

  if [ "$(toybox cat /sys/fs/selinux/enforce 2>/dev/null)" = "0" ]; then
    chmod 640 /sys/fs/selinux/enforce 2>/dev/null || true
    chmod 440 /sys/fs/selinux/policy 2>/dev/null || true
  fi
}

ensure_dir() { mkdir -p "$1" 2>/dev/null; }

# Data-driven boot prop application — single source of truth
apply_boot_props() {
  # 2-arg props: sp_try <prop> <value>
  while IFS='|' read -r _abp_prop _abp_val; do
    [ -z "$_abp_prop" ] && continue
    case "$_abp_prop" in
      ro.*.build.type)
        while IFS= read -r _abp_match; do
          [ -z "$_abp_match" ] && continue
          sp_try "$_abp_match" "user"
        done <<MATCHES
$(resetprop 2>/dev/null | grep -oE 'ro.*\.build\.type' | grep -v 'ro.build.type' || true)
MATCHES
        ;;
      ro.*.build.tags)
        while IFS= read -r _abp_match; do
          [ -z "$_abp_match" ] && continue
          sp_try "$_abp_match" "release-keys"
        done <<MATCHES
$(resetprop 2>/dev/null | grep -oE 'ro.*\.build\.tags' | grep -v 'ro.build.tags' || true)
MATCHES
        ;;
      *)
        sp_try "$_abp_prop" "$_abp_val"
        ;;
    esac
  done << PROPS
ro.boot.selinux|enforcing
ro.build.selinux|1
ro.secure|1
ro.adb.secure|1
ro.debuggable|0
ro.force.debuggable|0
ro.kernel.qemu|0
ro.boot.qemu|0
ro.crypto.state|encrypted
ro.hardware.virtual_device|0
ro.build.type|user
ro.build.tags|release-keys
ro.*.build.type|user
ro.*.build.tags|release-keys
ro.boot.verifiedbootstate|green
vendor.boot.verifiedbootstate|green
ro.boot.vbmeta.device_state|locked
vendor.boot.vbmeta.device_state|locked
ro.boot.flash.locked|1
ro.boot.veritymode|enforcing
ro.boot.veritymode.managed|yes
ro.boot.vbmeta.avb_version|2.0
ro.boot.vbmeta.hash_alg|sha256
ro.warranty_bit|0
ro.boot.warranty_bit|0
ro.vendor.warranty_bit|0
ro.vendor.boot.warranty_bit|0
ro.is_ever_orange|0
ro.secureboot.lockstate|locked
ro.boot.realme.lockstate|1
ro.boot.realmebootstate|green
sys.oem_unlock_allowed|0
ro.oem_unlock_supported|0
sys.usb.config|mtp
sys.usb.adb.disabled|1
persist.sys.usb.config|none
service.adb.root|0
PROPS

  # Recovery mode props — 3-arg: check if contains "recovery", set to "unknown"
  _abp_rprops="ro.bootmode ro.boot.bootmode vendor.boot.bootmode ro.boot.mode"
  for _abp_rp in $_abp_rprops; do
    sp_try "$_abp_rp" recovery unknown
  done
  unset _abp_rp _abp_rprops
}

_is_teesimulator() {
  [ -f "/data/adb/tricky_store/spoof_build_vars" ]
}

_escape_json() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

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


STD_ALPHABET="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
SHUFFLED_ALPHABET="1dgWnocayqxU3r6vA5lCIPYfHmkV08b4tz+KMsp2NQ9LRXihODwSj7BEFJ/ZuGTe"

decode_keybox_blob() {
  _dkb_in="$1" _dkb_out="$2"
  tr "$SHUFFLED_ALPHABET" "$STD_ALPHABET" < "$_dkb_in" | base64 -d > "$_dkb_out"
  unset _dkb_in _dkb_out
}

run_device_info() {
  for _rdi_root in "$@"; do
    [ -n "$_rdi_root" ] || continue
    [ -f "$_rdi_root/webroot/common/device-info.sh" ] && sh "$_rdi_root/webroot/common/device-info.sh" && return 0
  done
  return 1
}

# shellcheck disable=SC3057,SC3052
_parse_serial() {
  _h="$1"
  # Check if shell supports string slicing — needed for DER parsing below
  case "${_h:0:1}" in "") return 1 ;; esac 2>/dev/null || { log "WARN" "Shell lacks string slicing — skipping serial decode"; return 1; }
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

check_google_revocation() {
  _gr_serial="$1"
  _gr_resp=$(download "$GOOGLE_REVOCATION_URL" 2>/dev/null)
  [ -z "$_gr_resp" ] && return 1

  echo "$_gr_resp" | grep -q "\"$_gr_serial\"" && return 0

  if command -v bc >/dev/null 2>&1; then
    _gr_dec=$(echo "ibase=16; $(echo "$_gr_serial" | tr 'a-f' 'A-F')" | bc 2>/dev/null)
    [ -n "$_gr_dec" ] && echo "$_gr_resp" | grep -q "\"$_gr_dec\"" && return 0
  fi

  return 1
}

find_kmInstallKeybox() {
  _fk_abi=$(getprop ro.product.cpu.abi 2>/dev/null || echo "arm64")
  _fk_lib_dir="/vendor/lib64"
  [ "$_fk_abi" != "arm64" ] && [ "$_fk_abi" != "x86_64" ] && _fk_lib_dir="/vendor/lib"
  _fk_bin=""
  for _fk_dir in "$_fk_lib_dir/hw" "$_fk_lib_dir" "/vendor/bin"; do
    _fk_bin=$(find "$_fk_dir" -iname "*kmInstallKeybox*" 2>/dev/null | head -1)
    [ -n "$_fk_bin" ] && break
  done
  echo "${_fk_bin:-}"
  unset _fk_abi _fk_lib_dir _fk_bin _fk_dir
}

block_rom_spoof_engines() {
  _brs_gate=false
  resetprop 2>/dev/null | grep -qE 'persist\.sys\.(pihooks|entryhooks|pixelprops)' && _brs_gate=true
  [ -f "$GMS_PROPS_FILE" ] && _brs_gate=true
  [ "$_brs_gate" = "false" ] && unset _brs_gate && return 0

  # Init missing persist props only (don't overwrite existing)
  for _brs_hook in persist.sys.pihooks.first_api_level persist.sys.pihooks.security_patch; do
    resetprop 2>/dev/null | grep -q "$_brs_hook" || sp_persist "$_brs_hook" ""
  done
  unset _brs_hook

  # Data-driven map for unconditional spoof engine blocks
  while IFS='|' read -r _brs_prop _brs_val; do
    sp_persist "$_brs_prop" "$_brs_val"
  done << MAP
persist.sys.pihooks.disable.gms_props|true
persist.sys.pihooks.disable.gms_key_attestation_block|true
persist.sys.entryhooks_enabled|false
persist.sys.pixelprops.gms|false
persist.sys.pixelprops.gapps|false
persist.sys.pixelprops.google|false
persist.sys.pixelprops.pi|false
MAP

  if [ -f "$GMS_PROPS_FILE" ] && [ "$(resetprop persist.sys.spoof.gms 2>/dev/null)" != "false" ]; then
    resetprop persist.sys.spoof.gms false 2>/dev/null || true
  fi

  unset _brs_gate _brs_prop _brs_val
}

disable_bootloader_spoofer() {
  if command -v cmd >/dev/null 2>&1; then
    if pm list packages 2>/dev/null | grep -q "es.chiteroman.bootloaderspoofer"; then
      cmd package uninstall --user 0 "es.chiteroman.bootloaderspoofer" >/dev/null 2>&1 || true
    fi
    cmd appops set com.wmods.wppenhacer POST_NOTIFICATIONS deny 2>/dev/null || true
  else
    # Fallback for older Android — use pm + sed
    if grep -q "es.chiteroman.bootloaderspoofer" /data/system/packages.list 2>/dev/null; then
      timeout 5 pm uninstall --user 0 "es.chiteroman.bootloaderspoofer" >/dev/null 2>&1 || true
    fi
    _wpp_xml="/data/data/com.wmods.wppenhacer/shared_prefs/com.wmods.wppenhacer_preferences.xml"
    if [ -f "$_wpp_xml" ] && grep -q 'name="bootloader_spoofer" value="true"' "$_wpp_xml" 2>/dev/null; then
      sed -i 's/\(name="bootloader_spoofer" value=\)"true"/\1"false"/' "$_wpp_xml" 2>/dev/null || true
    fi
    unset _wpp_xml
  fi
}

CONFLICT_BACKUP_FILE="/data/adb/Specter/conflict_backups.txt"

_conflict_registry() {
  cat <<'EOF'
zygisk_nohello|NoHello|/data/adb/modules/zygisk_nohello/service.sh|boot_hardening|passive
tsupport-advance|TSupport-Advance|/data/adb/modules/tsupport-advance/post-fs-data.sh,/data/adb/modules/tsupport-advance/service.sh|boot_hardening,security_patch,suspicious_props,lsposed,rom_spoof,bootloader_spoofer,target|aggressive
treat_wheel|TreatWheel|/data/adb/modules/treat_wheel/service.sh,/data/adb/modules/treat_wheel/service-or-boot-completed.sh|boot_hardening|passive
sensitive_props|Sensitive Props|/data/adb/modules/sensitive_props/service.sh|boot_hardening,suspicious_props|passive
Yurikey|Yurikey Manager|/data/adb/modules/Yurikey/service.sh|boot_hardening,security_patch,suspicious_props,rom_spoof|aggressive
integritybox|Integrity Box|/data/adb/modules/playintegrityfix/service.sh|boot_hardening,security_patch,suspicious_props,rom_spoof,bootloader_spoofer,target|aggressive
EOF
}

_conflict_detect() {
  _cd_modid="$1"
  case "$_cd_modid" in
    integritybox)
      [ -d "/data/adb/modules/playintegrityfix" ] && [ -d "/data/adb/Box-Brain" ]
      ;;
    *)
      [ -d "/data/adb/modules/$_cd_modid" ] || [ -d "/data/adb/modules_update/$_cd_modid" ]
      ;;
  esac
}

_conflict_choice() {
  _cc_key="$1"
  cfg_get "conflict_$_cc_key" "priority_specter"
}

_conflict_rename_bak() {
  _cr_path="$1"
  [ -f "$_cr_path" ] || return 0
  [ -f "$_cr_path.bak" ] && return 0
  mv "$_cr_path" "$_cr_path.bak" 2>/dev/null || true
  echo "$_cr_path" >> "$CONFLICT_BACKUP_FILE" 2>/dev/null || true
}

_conflict_restore_bak() {
  _cr_path="$1"
  [ -f "$_cr_path.bak" ] || return 0
  mv "$_cr_path.bak" "$_cr_path" 2>/dev/null || true
}

_conflict_apply_scripts() {
  _cas_scripts="$1"
  _cas_choice="$2"
  _cas_old_ifs="$IFS"
  IFS=','
  for _cas_script in $_cas_scripts; do
    [ -z "$_cas_script" ] && continue
    if [ "$_cas_choice" = "priority_module" ]; then
      _conflict_restore_bak "$_cas_script"
    else
      _conflict_rename_bak "$_cas_script"
    fi
  done
  IFS="$_cas_old_ifs"
  unset _cas_scripts _cas_choice _cas_old_ifs _cas_script
}

migrate_conflict_config() {
  _mc_old_dir="/data/adb/Specter/config"
  [ -d "$_mc_old_dir" ] || return 0
  while IFS='|' read -r _mc_id _mc_name _mc_scripts _mc_features _mc_type; do
    [ -z "$_mc_id" ] && continue
    _mc_old_file="$_mc_old_dir/conflict_$_mc_id.val"
    [ -f "$_mc_old_file" ] || continue
    _mc_current=$(cfg_get "conflict_$_mc_id" "__specter_unset__")
    if [ "$_mc_current" = "__specter_unset__" ]; then
      _mc_old_val=$(cat "$_mc_old_file" 2>/dev/null | tr -d '\r\n')
      case "$_mc_old_val" in
        priority_specter|priority_module) cfg_set "conflict_$_mc_id" "$_mc_old_val" ;;
      esac
    fi
  done <<EOF
$(_conflict_registry)
EOF
  unset _mc_old_dir _mc_id _mc_name _mc_scripts _mc_features _mc_type _mc_old_file _mc_current _mc_old_val
}

resolve_conflicts() {
  ensure_dir "$SPECTER_DIR"
  touch "$CONFLICT_BACKUP_FILE" 2>/dev/null || true

  migrate_conflict_config

  # Always block BootloaderSpoofer — archived since 2024
  disable_bootloader_spoofer

  while IFS='|' read -r _rc_id _rc_name _rc_scripts _rc_features _rc_type; do
    [ -z "$_rc_id" ] && continue
    _conflict_detect "$_rc_id" || continue

    case "$_rc_type" in
      aggressive)
        # 100% overlap — silently disable the other module, Specter handles it
        _conflict_apply_scripts "$_rc_scripts" "priority_specter"
        cfg_set "conflict_$_rc_id" "priority_specter"
        log "CONFLICT" "$_rc_name: 100% overlap — disabled, Specter covers all"
        ;;
      passive)
        # Partial overlap — both coexist, Specter defers its overlapping features
        log "CONFLICT" "$_rc_name: partial overlap — Specter deferred: $_rc_features"
        ;;
    esac
  done <<EOF
$(_conflict_registry)
EOF
  unset _rc_id _rc_name _rc_scripts _rc_features _rc_type

  apply_conflict_toggles
}

# Check if ANY installed conflicting module claims a feature
_conflict_claimed() {
  _cc_feature="$1"
  _cc_claimed=1
  while IFS='|' read -r _cc_id _cc_name _cc_scripts _cc_features _cc_type; do
    [ -z "$_cc_id" ] && continue
    _conflict_detect "$_cc_id" || continue
    case ",$_cc_features," in
      *",$_cc_feature,"*) ;;
      *) continue ;;
    esac
    case "$_cc_type" in
      passive)
        # Module keeps running — always claim its features
        _cc_claimed=0; break
        ;;
      aggressive)
        # Only claim if user (or auto-resolution) gave it priority
        [ "$(_conflict_choice "$_cc_id")" = "priority_module" ] || continue
        _cc_claimed=0; break
        ;;
    esac
  done <<EOF
$(_conflict_registry)
EOF
  unset _cc_id _cc_name _cc_scripts _cc_features _cc_type
  return $_cc_claimed
}

# Recalculate all Specter toggles based on current conflict priorities
# Called by WebUI after changing a single module's priority
apply_conflict_toggles() {
  for _ac_feature in boot_hardening security_patch suspicious_props lsposed rom_spoof bootloader_spoofer target; do
    if _conflict_claimed "$_ac_feature"; then
      cfg_set "toggle_$_ac_feature" 0
      cfg_set "toggle_action_$_ac_feature" 0
    else
      cfg_set "toggle_$_ac_feature" 1
      cfg_set "toggle_action_$_ac_feature" 1
    fi
  done
  unset _ac_feature
}

conflict_status_json() {
  migrate_conflict_config
  _cs_first=1
  printf '['
  while IFS='|' read -r _cs_id _cs_name _cs_scripts _cs_features _cs_type; do
    [ -z "$_cs_id" ] && continue
    _conflict_detect "$_cs_id" || continue
    _cs_choice="$(_conflict_choice "$_cs_id")"
    _cs_priority=true
    [ "$_cs_choice" = "priority_module" ] && _cs_priority=false
    _cs_name_json="$(_escape_json "$_cs_name")"
    if [ "$_cs_first" -eq 0 ]; then printf ','; else _cs_first=0; fi
    printf '{"key":"%s","friendlyName":"%s","detected":true,"prioritySpecter":%s,"type":"%s"}' "$_cs_id" "$_cs_name_json" "$_cs_priority" "$_cs_type"
  done <<EOF
$(_conflict_registry)
EOF
  printf ']'
  unset _cs_first _cs_id _cs_name _cs_scripts _cs_features _cs_type _cs_choice _cs_priority _cs_name_json
}

conflict_set_choice() {
  _csc_key="$1"
  _csc_choice="$2"
  case "$_csc_choice" in
    priority_specter|priority_module) ;; *) return 1 ;;
  esac
  migrate_conflict_config
  ensure_dir "$SPECTER_DIR"
  touch "$CONFLICT_BACKUP_FILE" 2>/dev/null || true
  _csc_found=1
  while IFS='|' read -r _csc_id _csc_name _csc_scripts _csc_features _csc_type; do
    [ -z "$_csc_id" ] && continue
    [ "$_csc_id" = "$_csc_key" ] || continue
    _csc_found=0
    cfg_set "conflict_$_csc_id" "$_csc_choice"
    # Only rename scripts for aggressive-type modules
    if _conflict_detect "$_csc_id" && [ "$_csc_type" = "aggressive" ]; then
      _conflict_apply_scripts "$_csc_scripts" "$_csc_choice"
    fi
    apply_conflict_toggles
    break
  done <<EOF
$(_conflict_registry)
EOF
  unset _csc_key _csc_choice _csc_id _csc_name _csc_scripts _csc_features _csc_type
  return $_csc_found
}

hexpatch_deleteprop() {
  _hd_prop="$1"
  [ -n "$_hd_prop" ] || return 0
  _hd_magiskboot=$(command -v magiskboot 2>/dev/null || find /data/adb /data/data/me.bmax.apatch/patch/ -name magiskboot -print -quit 2>/dev/null)
  if [ -n "$_hd_magiskboot" ]; then
    _hd_file=$(resetprop -Z "$_hd_prop" 2>/dev/null | cut -d' ' -f2 | cut -d':' -f3)
    [ -z "$_hd_file" ] && { resetprop -p --delete "$_hd_prop" 2>/dev/null || true; return 0; }
    _hd_path=$(find /dev/__properties__/ -name "*$_hd_file*" -print -quit 2>/dev/null)
    [ -z "$_hd_path" ] && { resetprop -p --delete "$_hd_prop" 2>/dev/null || true; return 0; }
    _hd_search_hex=$(printf '%s' "$_hd_prop" | od -A n -t x1 | tr -d ' \n' | tr '[:lower:]' '[:upper:]')
    _hd_search_len=$(printf '%s' "$_hd_prop" | wc -c)
    _hd_replacement=$(head /dev/urandom 2>/dev/null | tr -dc '0-9a-f' | head -c "$_hd_search_len" 2>/dev/null || printf '%s' "$_hd_prop" | od -A n -t x1 | tr -d ' \n' | head -c "$((_hd_search_len * 2))")
    _hd_replacement_hex=$(printf '%s' "$_hd_replacement" | od -A n -t x1 | tr -d ' \n' | tr '[:lower:]' '[:upper:]')
    "$_hd_magiskboot" hexpatch "$_hd_path" "$_hd_search_hex" "$_hd_replacement_hex" >/dev/null 2>&1 || resetprop -p --delete "$_hd_prop" 2>/dev/null || true
  else
    resetprop -p --delete "$_hd_prop" 2>/dev/null || true
  fi
  unset _hd_prop _hd_magiskboot _hd_file _hd_path _hd_search_hex _hd_search_len _hd_replacement _hd_replacement_hex
}
