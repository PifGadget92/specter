#!/system/bin/sh
MODDIR=${0%/*}
. "$MODDIR/../lib/common.sh"
. "$MODDIR/../lib/paths.sh"
. "$MODDIR/../lib/urls.sh"

KEYBOX_FILE="/data/adb/tricky_store/keybox.xml"
INFO_PATH="$MODDIR/../webroot/json/keybox_info.json"

ensure_dir "$(dirname "$INFO_PATH")"

_installed=false
_source=""
_source_version=""
_text=""
_up_to_date=false
_revoked=false

if [ -f "$KEYBOX_FILE" ]; then
  _installed=true

  if _serial=$(decode_keybox_serial "$KEYBOX_FILE"); then
    log "KEYBOX_INFO" "Serial: $_serial"

    if check_network; then
      _history_json=$(download "$CATALOG_URL" 2>/dev/null)
      log "KEYBOX_INFO" "History response length: ${#_history_json}"

      if [ -n "$_history_json" ]; then
        # Resolve provider: if auto, use the working entry's source
        _provider=$(cat "$YURIKEY_CONFIG_DIR/kb_provider.val" 2>/dev/null || echo "auto")
        if [ "$_provider" = "auto" ]; then
          _provider=$(echo "$_history_json" | grep -o '"working":{[^}]*"source":"[^"]*"' | sed 's/.*"source":"\([^"]*\)".*/\1/')
        fi
        # Try to match by source + serial first (handles duplicate serials across providers)
        if [ -n "$_provider" ]; then
          _entry=$(echo "$_history_json" | grep -o '{[^}]*"source":"'"$_provider"'"[^}]*"serial":"'"$_serial"'"[^}]*}')
        fi
        # Fall back to any serial match
        if [ -z "$_entry" ]; then
          _entry=$(echo "$_history_json" | grep -o '{[^}]*"serial":"'"$_serial"'"[^}]*}')
        fi
        if [ -n "$_entry" ]; then
          _source=$(echo "$_entry" | grep -o '"source":"[^"]*"' | head -1 | sed 's/"source":"//;s/"//')
          _source_version=$(echo "$_entry" | grep -o '"version":"[^"]*"' | head -1 | sed 's/"version":"//;s/"//')
          _text=$(echo "$_entry" | grep -o '"text":"[^"]*"' | head -1 | sed 's/"text":"//;s/"//')
          _revoked=$(echo "$_entry" | grep -o '"revoked":\(true\|false\)' | head -1 | sed 's/"revoked"://')
          [ -z "$_source" ] && _source="yuri"
          [ -z "$_source_version" ] && _source_version="?"
          [ -z "$_text" ] && _text="$_source_version"
          [ -z "$_revoked" ] && _revoked=false
          log "KEYBOX_INFO" "Found: source=$_source version=$_source_version text=$_text revoked=$_revoked"

          # Check if up-to-date by comparing with latest for this source
          _latest_for_source=$(echo "$_history_json" | grep -o '"'"$_source"'":"[^"]*"' | sed 's/.*":"//;s/"//')
          if [ -n "$_source_version" ] && [ "$_source_version" = "$_latest_for_source" ]; then
            _up_to_date=true
          fi
        else
          log "KEYBOX_INFO" "Not found in history"
        fi
      fi
    else
      log "KEYBOX_INFO" "Network check failed"
    fi
  fi
fi

cat <<EOF > "$INFO_PATH"
{
  "installed": $_installed,
  "source": "$(_escape_json "$_source")",
  "source_version": "$(_escape_json "$_source_version")",
  "text": "$(_escape_json "$_text")",
  "up_to_date": $_up_to_date,
  "revoked": $_revoked
}
EOF

unset _installed _source _source_version _text _up_to_date _revoked _b64 _hex _serial _serial_hex _history_json _entry _ctx_len_hex _ctx_len _l_hex _l_dec _n _sl _latest_for_source
exit 0
