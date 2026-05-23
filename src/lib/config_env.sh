# shellcheck shell=sh
cfg_get() {
    _cg_key="$1" _cg_default="$2"
    _cg_val=$(cat "$CONFIG_DIR/$_cg_key.val" 2>/dev/null)
    printf '%s' "${_cg_val:-$_cg_default}"
    unset _cg_key _cg_default _cg_val
}

cfg_set() {
    _cs_key="$1" _cs_val="$2"
    mkdir -p "$CONFIG_DIR" 2>/dev/null
    printf '%s' "$_cs_val" > "$CONFIG_DIR/$_cs_key.val"
    unset _cs_key _cs_val
}

