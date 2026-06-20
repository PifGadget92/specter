# shellcheck shell=sh disable=SC2034

# Base directories
MODULES_BASE="/data/adb/modules"
SPECTER_DIR="/data/adb/specter"
TRICKY_DIR="/data/adb/tricky_store"

# Module paths (other modules under MODULES_BASE)
PIF_DIR="$MODULES_BASE/playintegrityfix"
ZYNEXT_DIR="$MODULES_BASE/zygisksu"

# Tricky Store paths
TARGET_FILE="$TRICKY_DIR/keybox.xml"
BACKUP_FILE="$SPECTER_DIR/backup/keybox.xml.bak"
LOCKED_FILE="$TRICKY_DIR/locked.xml"
LOCKED_BACKUP="$SPECTER_DIR/backup/locked.xml.bak"
TARGET_TXT="$TRICKY_DIR/target.txt"
SECURITY_PATCH_FILE="$TRICKY_DIR/security_patch.txt"
TEE_STATUS="$SPECTER_DIR/tee_status"
TEE_HASH="$SPECTER_DIR/tee_hash"
TEE_TIER="$SPECTER_DIR/tee_tier"
TEE_KEYMASTER_VER="$SPECTER_DIR/tee_keymaster_version"
TEE_CHALLENGE="$SPECTER_DIR/tee_challenge"
VBMETA_DIGEST="$SPECTER_DIR/vbmeta_digest"

# Other system paths
HMA_DIR="/data/user/0/org.frknkrc44.hma_oss/files"
HMA_FILE="$HMA_DIR/config.json"
GMS_PROPS_FILE="/data/system/gms_certified_props.json"

# Backup directory (first-boot snapshots of original Tricky Store files)
BACKUP_DIR="$SPECTER_DIR/backup"

# BBIN, CONFIG_DIR, MIGRATION_MARKER set in common.sh
