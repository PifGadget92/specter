#!/system/bin/sh
# shellcheck shell=bash
# Read big-endian integer (N bytes, default 8) from file at offset
_val() {
  local _h
  _h=$(dd if="$1" bs=1 skip=$2 count=${3:-8} 2>/dev/null \
    | od -An -tx1 | tr -d ' \n')
  echo $((16#${_h:-0}))
}

# Emit VBMeta blob from a partition (handles AVB footer + raw VBMeta)
emit_vbmeta() {
  local _dev="$1" _sz _tail _prefix _pos _vb_off _vb_sz _auth_sz _aux_sz _total
  [ -b "$_dev" ] || return 1
  _sz=$(blockdev --getsize64 "$_dev" 2>/dev/null) || return 1

  # Check last 256 bytes for AVB footer ("AVBf" = hex 41564266)
  _tail=$(dd if="$_dev" bs=1 skip=$((_sz - 256)) count=256 2>/dev/null \
    | od -An -tx1 -v | tr -d ' \n')
  case "$_tail" in
    *41564266*)
      _prefix="${_tail%%41564266*}"
      _pos=$((_sz - 256 + ${#_prefix} / 2))
      _vb_off=$(_val "$_dev" $((_pos + 20)))
      _vb_sz=$(_val "$_dev" $((_pos + 28)))
      dd if="$_dev" bs=1 skip=$_vb_off count=$_vb_sz 2>/dev/null
      return 0
      ;;
  esac

  # Raw VBMeta
  [ "$(dd if="$_dev" bs=1 count=4 2>/dev/null)" = "AVB0" ] || return 1
  _auth_sz=$(_val "$_dev" 12)
  _aux_sz=$(_val "$_dev" 20)
  _total=$((256 + _auth_sz + _aux_sz))
  dd if="$_dev" bs=$_total count=1 2>/dev/null
}

# Calculate full VBMeta digest including chain partitions
vbmeta_digest() {
  local _part="$1" _auth_sz _aux_sz _total
  local _desc_off _desc_sz _aux_start _pos _pos_end
  local _tag _nbf _name_sz _name _d
  [ -b "$_part" ] || return 1
  _auth_sz=$(_val "$_part" 12)
  _aux_sz=$(_val "$_part" 20)
  _desc_off=$(_val "$_part" 96)
  _desc_sz=$(_val "$_part" 104)
  _total=$((256 + _auth_sz + _aux_sz))

  (
    dd if="$_part" bs=$_total count=1 2>/dev/null
    _aux_start=$((256 + _auth_sz))
    _pos=$((_aux_start + _desc_off))
    _pos_end=$((_aux_start + _desc_off + _desc_sz))
    while [ $_pos -lt $_pos_end ]; do
      _tag=$(_val "$_part" $_pos)
      _nbf=$(_val "$_part" $((_pos + 8)))
      if [ $_tag -eq 4 ]; then
        _name_sz=$(_val "$_part" $((_pos + 20)) 4)
        _name=$(dd if="$_part" bs=1 skip=$((_pos + 92)) count=$_name_sz 2>/dev/null)
        for _d in "/dev/block/by-name/$_name" "/dev/block/bootdevice/by-name/$_name"; do
          emit_vbmeta "$_d" 2>/dev/null && break
        done
      fi
      _pos=$((_pos + 16 + _nbf))
    done
  ) | sha256sum | cut -d' ' -f1
}
