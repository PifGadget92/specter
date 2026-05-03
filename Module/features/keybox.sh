#!/system/bin/sh
MODDIR=${0%/*}
. "$MODDIR/../lib/common.sh"
. "$MODDIR/../lib/paths.sh"
. "$MODDIR/../lib/urls.sh"

log "KEYBOX" "Start"

check_network || { log "KEYBOX" "Error: No internet connection"; exit 1; }

if [ ! -d "/data/adb/tricky_store" ]; then
  log "KEYBOX" "Error: Tricky Store data directory not found"
  exit 1
fi

if [ -f "$TARGET_FILE" ] && [ ! -f "$BACKUP_FILE" ]; then
  cp "$TARGET_FILE" "$BACKUP_FILE"
  log "KEYBOX" "Created backup of existing keybox"
fi

DECODE_FILE="$TRICKY_DIR/keybox_decode"
TEMP_FILE="$TRICKY_DIR/keybox.tmp"

# Check for custom keybox config (set via WebUI "Set Custom Keybox")
_custom_type=$(cat "$YURIKEY_CONFIG_DIR/kb_custom_type.val" 2>/dev/null || echo "")
_custom_value=$(cat "$YURIKEY_CONFIG_DIR/kb_custom_value.val" 2>/dev/null || echo "")

if [ -n "$_custom_type" ] && [ -n "$_custom_value" ]; then
  log "KEYBOX" "Using custom keybox: $_custom_type ($_custom_value)"
  case "$_custom_type" in
    file|path)
      if [ -f "$_custom_value" ]; then
        cp "$_custom_value" "$TARGET_FILE" || die "Failed to copy custom keybox"
        log "KEYBOX" "Custom keybox installed from $_custom_value"
        rm -f "$TEMP_FILE"
        exit 0
      else
        log "KEYBOX" "Error: Custom keybox file not found: $_custom_value"
        # Fall through to default behavior
      fi
      ;;
    url)
      log "KEYBOX" "Downloading custom keybox from URL..."
      download "$_custom_value" > "$TEMP_FILE" || {
        log "KEYBOX" "Error: Custom URL download failed"
        rm -f "$TEMP_FILE"
        [ -f "$BACKUP_FILE" ] && cp "$BACKUP_FILE" "$TARGET_FILE"
        exit 1
      }
      # Try base64 decode; if fails, treat as raw XML
      if base64 -d "$TEMP_FILE" > "$DECODE_FILE" 2>/dev/null && [ -s "$DECODE_FILE" ]; then
        mv "$DECODE_FILE" "$TARGET_FILE" || die "Failed to move decoded keybox"
      else
        # Raw XML, just copy
        cp "$TEMP_FILE" "$TARGET_FILE" || die "Failed to copy keybox"
      fi
      rm -f "$TEMP_FILE"
      log "KEYBOX" "Custom keybox installed from URL"
      exit 0
      ;;
  esac
fi

# Read the selected provider
_provider=$(cat "$YURIKEY_CONFIG_DIR/kb_provider.val" 2>/dev/null || echo "auto")

log "KEYBOX" "Fetching available keyboxes..."
_history=$(download "$CATALOG_URL" 2>/dev/null)
if [ -z "$_history" ]; then
  log "KEYBOX" "Error: Failed to fetch keybox list"
  exit 1
fi

if [ "$_provider" = "auto" ]; then
  # Use the working keybox (best non-revoked across all providers)
  _working_source=$(echo "$_history" | grep -o '"working":{[^}]*"source":"[^"]*"' | sed 's/.*"source":"\([^"]*\)".*/\1/')
  _working_version=$(echo "$_history" | grep -o '"working":{[^}]*"version":"[^"]*"' | sed 's/.*"version":"\([^"]*\)".*/\1/')

  if [ -z "$_working_source" ] || [ -z "$_working_version" ]; then
    log "KEYBOX" "Error: No working keybox available (all revoked?)"
    exit 1
  fi

  _DL_SOURCE="$_working_source"
  _DL_VER="$_working_version"
  log "KEYBOX" "Auto-selected: $_working_source $_working_version"
else
  # Specific provider — find its latest non-revoked version
  _DL_SOURCE="$_provider"
   _DL_VER=$(echo "$_history" | grep -o '"source":"'"$_provider"'"[^}]*"version":"[^"]*"' | sed 's/.*"version":"\([^"]*\)".*/\1/' | sort -rn | head -1)

  if [ -z "$_DL_VER" ]; then
    log "KEYBOX" "Error: No versions found for provider '$_provider'"
    exit 1
  fi
  log "KEYBOX" "Selected provider: $_provider $_DL_VER"
fi

log "KEYBOX" "Downloading keybox $_DL_SOURCE $_DL_VER..."
_DL_URL="$KEYBOX_URL/$_DL_SOURCE/$_DL_VER"
download "$_DL_URL" > "$TEMP_FILE" || {
  log "KEYBOX" "Error: Download failed"
  rm -f "$TEMP_FILE"
  [ -f "$BACKUP_FILE" ] && cp "$BACKUP_FILE" "$TARGET_FILE"
  exit 1
}

if ! base64 -d "$TEMP_FILE" > "$DECODE_FILE" 2>/dev/null; then
  log "KEYBOX" "Error: Base64 decode failed"
  rm -f "$TEMP_FILE" "$DECODE_FILE"
  [ -f "$BACKUP_FILE" ] && cp "$BACKUP_FILE" "$TARGET_FILE"
  exit 1
fi

if [ ! -s "$DECODE_FILE" ]; then
  log "KEYBOX" "Error: Decoded keybox is empty"
  rm -f "$TEMP_FILE" "$DECODE_FILE"
  [ -f "$BACKUP_FILE" ] && cp "$BACKUP_FILE" "$TARGET_FILE"
  exit 1
fi

mv "$DECODE_FILE" "$TARGET_FILE" || die "Failed to move decoded keybox to $TARGET_FILE"
rm -f "$TEMP_FILE"
log "KEYBOX" "Keybox $_DL_SOURCE $_DL_VER installed successfully"
log "KEYBOX" "Finish"
exit 0
