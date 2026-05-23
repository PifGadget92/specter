# shellcheck shell=sh
# Module description — compute and apply rich status line.
# Provides refresh_module_description() for boot-time and on-demand use.

refresh_module_description() {
  _desc_restore_e=
  case $- in *e*) _desc_restore_e=1 ;; esac

if [ ! -d "/data/adb/modules/tricky_store" ] && [ ! -d "/data/adb/modules_update/tricky_store" ]; then
  cfg_set "override.description" "🚨 Tricky Store not installed"

else
  _cf=""
  while IFS='|' read -r _id _name _scripts _features _type; do
    [ -z "$_id" ] && continue
    [ "$_type" != "aggressive" ] && continue
    _conflict_detect "$_id" || continue
    _cf="$_name"
    break
  done <<CF_EOF
$(_conflict_registry)
CF_EOF

  if [ -n "$_cf" ]; then
    cfg_set "override.description" "🚨 Conflict: $_cf"
    unset _cf _id _name _scripts _features _type
  else
    unset _cf _id _name _scripts _features _type

    # Ensure keybox_info.json exists before reading
    if [ ! -f "$MODDIR/webroot/json/keybox_info.json" ]; then
      sh "$MODDIR/features/keybox_info.sh" >/dev/null 2>&1 || true
    fi
    _kb_src=$(grep -o '"source": *"[^"]*"' "$MODDIR/webroot/json/keybox_info.json" 2>/dev/null | cut -d'"' -f4) || true
    _kb_ver=$(grep -o '"text": *"[^"]*"' "$MODDIR/webroot/json/keybox_info.json" 2>/dev/null | cut -d'"' -f4) || true
    _kb_rev=$(grep -o '"revoked": *true' "$MODDIR/webroot/json/keybox_info.json" 2>/dev/null) || true
    _kb_soft=$(grep -o '"softbanned": *true' "$MODDIR/webroot/json/keybox_info.json" 2>/dev/null) || true

    [ -z "$_kb_src" ] && _kb_src=$(cfg_get 'kb_provider' '')
    [ -z "$_kb_src" ] && [ "$(cfg_get 'kb_private' 'false')" = "true" ] && _kb_src="Private"

    _apps=$(wc -l < "$TARGET_TXT" 2>/dev/null || echo 0)
    _patch=$(grep '^boot=' "$SECURITY_PATCH_FILE" 2>/dev/null | cut -d= -f2) && [ -z "$_patch" ] && _patch="-"

    if [ -f "$TARGET_FILE" ] || [ -f "$LOCKED_FILE" ]; then
      _title="$_kb_src${_kb_ver:+ $_kb_ver}"
      if [ -n "$_kb_rev" ]; then
        cfg_set "override.description" "🔑 $_title · ❌ | $_apps apps | 🛡️ $_patch"
      elif [ -n "$_kb_soft" ]; then
        cfg_set "override.description" "🔑 $_title · ⚠️ | $_apps apps | 🛡️ $_patch"
      else
        cfg_set "override.description" "🔑 $_title · ✅ | $_apps apps | 🛡️ $_patch"
      fi
    else
      cfg_set "override.description" "❌ No keybox | $_apps apps | 🛡️ $_patch"
    fi
    unset _kb_src _kb_ver _kb_rev _kb_soft _apps _patch _title _status
  fi
fi

_override=$(cfg_get "override.description" "")
if [ -n "$_override" ]; then
  _escaped=$(printf '%s\n' "$_override" | sed 's|[#/&\]|\\&|g')
  sed -i "s#^description=.*#description=$_escaped#" "$MODDIR/module.prop" 2>/dev/null
  unset _escaped

  for _ksud in /data/adb/ksu/bin/ksud /data/adb/ap/bin/ksud; do
    [ -x "$_ksud" ] || continue
    "$_ksud" module config --internal Specter set override.description "$_override" 2>/dev/null || true
  done
  unset _ksud
fi
unset _override
[ -n "$_desc_restore_e" ] || set +e
unset _desc_restore_e
}
