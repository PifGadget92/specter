#!/bin/bash
# Conflict Resolution System Test Suite
# Runs in pure shell on any Linux box — no Android device needed.
# Usage: bash tests/test_conflicts.sh

set -e
BASE="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0

GRN='\033[0;32m'; RED='\033[0;31m'; CYN='\033[0;36m'; NC='\033[0m'

setup_env() {
  export TEST_ROOT="$(mktemp -d /tmp/specter_test.XXXXXX)"
  mkdir -p "$TEST_ROOT/modules" "$TEST_ROOT/specter_data" "$TEST_ROOT/Specter/config"

  # Seed the conflicts registry
  cp "$BASE/src/config/conflicts.txt" "$TEST_ROOT/Specter/config/conflicts.txt"

  # MODDIR points at the fake Specter module
  export MODDIR="$TEST_ROOT/Specter"

  . "$BASE/src/lib/common.sh"
  . "$BASE/src/lib/paths.sh"
  . "$BASE/src/lib/config_env.sh"
  . "$BASE/tests/mocks/android.sh"
  detect_root_solution

  touch "$CONFLICT_BACKUP_FILE" 2>/dev/null || true
}

teardown_env() {
  rm -rf "$TEST_ROOT" 2>/dev/null || true
}

# Helpers
cfg_read() { cfg_get "$1" "N/A"; }

create_module() {
  local id="$1"; shift
  mkdir -p "$TEST_ROOT/modules/$id"
  for script in "$@"; do
    touch "$TEST_ROOT/modules/$id/$script" 2>/dev/null || true
  done
}

remove_module() {
  rm -rf "$TEST_ROOT/modules/$1" 2>/dev/null || true
}

remove_all_modules() {
  for d in "$TEST_ROOT/modules/"*/; do
    [ -d "$d" ] || continue
    rm -rf "$d"
  done
}

reset_config() {
  rm -f "$TEST_ROOT/Specter/config/"*.val 2>/dev/null || true
  rm -f "$CONFLICT_BACKUP_FILE" 2>/dev/null || true
  touch "$CONFLICT_BACKUP_FILE" 2>/dev/null || true
}

# Assertions
assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo -e "  ${GRN}PASS${NC} $label"
  else
    echo -e "  ${RED}FAIL${NC} $label (expected: '$expected', got: '$actual')"
    return 1
  fi
}

assert_file_exists() {
  local label="$1" path="$2"
  if [ -f "$path" ]; then
    echo -e "  ${GRN}PASS${NC} $label"
  else
    echo -e "  ${RED}FAIL${NC} $label (file not found: $path)"
    return 1
  fi
}

assert_file_not_exists() {
  local label="$1" path="$2"
  if [ ! -f "$path" ] && [ ! -e "$path" ]; then
    echo -e "  ${GRN}PASS${NC} $label"
  else
    echo -e "  ${RED}FAIL${NC} $label (file should not exist: $path)"
    return 1
  fi
}

run_test() {
  local name="$1"
  echo ""
  echo -e "${CYN}=== $name ===${NC}"
  setup_env
  local rc=0
  ( set +e; $name ) || rc=$?
  teardown_env
  if [ "$rc" -eq 0 ]; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
  fi
  return $rc
}

# ============================================================
# TEST CASES
# ============================================================

tc01_no_conflicts() {
  remove_all_modules; reset_config
  resolve_conflicts
  local rc=0
  for f in boot_hardening recovery security_patch suspicious_props lsposed rom_spoof bootloader_spoofer; do
    assert_eq "toggle_$f defaults to 1" "1" "$(cfg_get "toggle_$f" 1)" || rc=1
  done
  for f in target security_patch keybox; do
    assert_eq "toggle_action_$f defaults to 1" "1" "$(cfg_get "toggle_action_$f" 1)" || rc=1
  done
  return $rc
}

tc02_passive_detected() {
  remove_all_modules; reset_config
  create_module "zygisk_nohello" "service.sh"
  resolve_conflicts
  local rc=0
  assert_eq "passive default choice" "priority_module" "$(cfg_get "conflict_zygisk_nohello" "")" || rc=1
  assert_eq "boot_hardening blocked" "0" "$(cfg_get "toggle_boot_hardening" 1)" || rc=1
  assert_eq "security_patch untouched" "1" "$(cfg_get "toggle_security_patch" 1)" || rc=1
  return $rc
}

tc03_aggressive_detected() {
  remove_all_modules; reset_config
  create_module "tsupport-advance" "post-fs-data.sh" "service.sh"
  resolve_conflicts
  local rc=0
  assert_eq "aggressive default choice" "priority_specter" "$(cfg_get "conflict_tsupport-advance" "")" || rc=1
  assert_eq "boot_hardening not claimed" "1" "$(cfg_get "toggle_boot_hardening" 1)" || rc=1
  assert_file_exists "post-fs-data.sh.bak exists" "$TEST_ROOT/modules/tsupport-advance/post-fs-data.sh.bak" || rc=1
  assert_file_not_exists "post-fs-data.sh removed" "$TEST_ROOT/modules/tsupport-advance/post-fs-data.sh" || rc=1
  assert_file_exists "service.sh.bak exists" "$TEST_ROOT/modules/tsupport-advance/service.sh.bak" || rc=1
  assert_file_not_exists "service.sh removed" "$TEST_ROOT/modules/tsupport-advance/service.sh" || rc=1
  return $rc
}

tc04_both_types() {
  remove_all_modules; reset_config
  create_module "zygisk_nohello" "service.sh"
  create_module "tsupport-advance" "post-fs-data.sh" "service.sh"
  create_module "treat_wheel" "service.sh"
  resolve_conflicts
  local rc=0
  assert_eq "passive nohello default" "priority_module" "$(cfg_get "conflict_zygisk_nohello" "")" || rc=1
  assert_eq "passive treat_wheel default" "priority_module" "$(cfg_get "conflict_treat_wheel" "")" || rc=1
  assert_eq "aggressive tsupport default" "priority_specter" "$(cfg_get "conflict_tsupport-advance" "")" || rc=1
  # boot_hardening claimed by zygisk_nohello (passive) → blocked
  assert_eq "boot_hardening blocked by passives" "0" "$(cfg_get "toggle_boot_hardening" 1)" || rc=1
  # prop_handler claimed by treat_wheel (passive) → blocked
  assert_eq "prop_handler blocked by treat_wheel" "0" "$(cfg_get "toggle_prop_handler" 1)" || rc=1
  # suspicious_props only claimed by sensitive_props (not installed) → stays 1
  assert_eq "suspicious_props untouched" "1" "$(cfg_get "toggle_suspicious_props" 1)" || rc=1
  return $rc
}

tc05_toggle_passive() {
  remove_all_modules; reset_config
  create_module "zygisk_nohello" "service.sh"
  resolve_conflicts
  local rc=0
  assert_eq "blocked before toggle" "0" "$(cfg_get "toggle_boot_hardening" 1)" || rc=1
  conflict_set_choice "zygisk_nohello" "priority_specter"
  assert_eq "freed after toggle" "1" "$(cfg_get "toggle_boot_hardening" 1)" || rc=1
  assert_eq "choice saved" "priority_specter" "$(cfg_get "conflict_zygisk_nohello" "")" || rc=1
  return $rc
}

tc06_toggle_aggressive() {
  remove_all_modules; reset_config
  create_module "tsupport-advance" "post-fs-data.sh" "service.sh"
  resolve_conflicts
  local rc=0
  assert_eq "not claimed before toggle" "1" "$(cfg_get "toggle_boot_hardening" 1)" || rc=1
  conflict_set_choice "tsupport-advance" "priority_module"
  assert_eq "claimed after toggle" "0" "$(cfg_get "toggle_boot_hardening" 1)" || rc=1
  assert_file_exists "service.sh restored" "$TEST_ROOT/modules/tsupport-advance/service.sh" || rc=1
  assert_file_not_exists "service.sh.bak removed" "$TEST_ROOT/modules/tsupport-advance/service.sh.bak" || rc=1
  return $rc
}

tc07_feature_should_run() {
  remove_all_modules; reset_config
  create_module "zygisk_nohello" "service.sh"
  resolve_conflicts
  local rc=0
  _feature_should_run "boot_hardening"; local r=$?
  assert_eq "blocked by passive conflict" "1" "$r" || rc=1
  _feature_should_run "security_patch"; r=$?
  assert_eq "allowed (no conflict)" "0" "$r" || rc=1
  # Toggle to priority_specter → Specter handles it
  conflict_set_choice "zygisk_nohello" "priority_specter"
  _feature_should_run "boot_hardening"; r=$?
  assert_eq "allowed after toggle" "0" "$r" || rc=1
  # User manually disables toggle → blocked regardless
  cfg_set "toggle_rom_spoof" "0"
  _feature_should_run "rom_spoof"; r=$?
  assert_eq "blocked by user toggle" "1" "$r" || rc=1
  return $rc
}

tc08_json_output() {
  remove_all_modules; reset_config
  create_module "zygisk_nohello" "service.sh"
  create_module "tsupport-advance" "post-fs-data.sh" "service.sh"
  resolve_conflicts
  local json=$(conflict_status_json)
  local rc=0
  echo "$json" | grep -q '^\['   || { echo "  ${RED}FAIL${NC} JSON start"; rc=1; }
  echo "$json" | grep -q '\]$'   || { echo "  ${RED}FAIL${NC} JSON end"; rc=1; }
  echo "$json" | grep -q '"key"'  || { echo "  ${RED}FAIL${NC} JSON key field"; rc=1; }
  echo "$json" | grep -q '"type"' || { echo "  ${RED}FAIL${NC} JSON type field"; rc=1; }
  echo "$json" | grep -q '"passive"' || { echo "  ${RED}FAIL${NC} JSON passive type value"; rc=1; }
  echo "$json" | grep -q '"aggressive"' || { echo "  ${RED}FAIL${NC} JSON aggressive type value"; rc=1; }
  [ "$rc" -eq 0 ] && echo -e "  ${GRN}PASS${NC} valid JSON output"
  return $rc
}

tc09_yurikey() {
  remove_all_modules; reset_config
  create_module "Yurikey" "service.sh"
  resolve_conflicts
  local rc=0
  assert_eq "yurikey default choice" "priority_specter" "$(cfg_get "conflict_Yurikey" "")" || rc=1
  assert_eq "boot_hardening not claimed" "1" "$(cfg_get "toggle_boot_hardening" 1)" || rc=1
  assert_eq "security_patch not claimed" "1" "$(cfg_get "toggle_security_patch" 1)" || rc=1
  return $rc
}

tc10_integritybox() {
  remove_all_modules; reset_config
  create_module "playintegrityfix" "service.sh"
  mkdir -p "$TEST_ROOT/Box-Brain"
  resolve_conflicts
  local rc=0
  assert_eq "integritybox detected" "priority_specter" "$(cfg_get "conflict_integritybox" "")" || rc=1
  assert_eq "boot_hardening not claimed" "1" "$(cfg_get "toggle_boot_hardening" 1)" || rc=1
  # Without Box-Brain, integritybox should NOT be detected
  cfg_set "conflict_integritybox" ""
  rm -rf "$TEST_ROOT/Box-Brain"
  local json=$(conflict_status_json)
  echo "$json" | grep -q '"key":"integritybox"' && {
    echo "  ${RED}FAIL${NC} integritybox should not be detected without Box-Brain"
    return 1
  }
  echo -e "  ${GRN}PASS${NC} integritybox not detected without Box-Brain"
  return 0
}

tc11_invalid_choice() {
  remove_all_modules; reset_config
  create_module "zygisk_nohello" "service.sh"
  resolve_conflicts
  conflict_set_choice "zygisk_nohello" "invalid_choice"
  local r=$?
  assert_eq "invalid choice returns error" "1" "$r" || return 1
  assert_eq "choice unchanged after error" "priority_module" "$(cfg_get "conflict_zygisk_nohello" "")" || return 1
  return 0
}

tc12_resolve_idempotent() {
  remove_all_modules; reset_config
  create_module "zygisk_nohello" "service.sh"
  create_module "tsupport-advance" "post-fs-data.sh" "service.sh"
  resolve_conflicts
  local v1=$(cfg_get "toggle_boot_hardening" "" | tr -d '\n')
  local c1=$(cfg_get "conflict_zygisk_nohello" "" | tr -d '\n')
  resolve_conflicts
  local v2=$(cfg_get "toggle_boot_hardening" "" | tr -d '\n')
  local c2=$(cfg_get "conflict_zygisk_nohello" "" | tr -d '\n')
  assert_eq "toggle unchanged after second resolve" "$v1" "$v2" || return 1
  assert_eq "choice unchanged after second resolve" "$c1" "$c2" || return 1
  return 0
}

tc13_action_toggles() {
  remove_all_modules; reset_config
  create_module "tsupport-advance" "post-fs-data.sh" "service.sh"
  resolve_conflicts
  local rc=0
  assert_eq "action_target not claimed default" "1" "$(cfg_get "toggle_action_target" 1)" || rc=1
  conflict_set_choice "tsupport-advance" "priority_module"
  assert_eq "action_target claimed after toggle" "0" "$(cfg_get "toggle_action_target" 1)" || rc=1
  return $rc
}

tc14_passive_sensitive_props() {
  remove_all_modules; reset_config
  create_module "sensitive_props" "service.sh"
  resolve_conflicts
  local rc=0
  assert_eq "sensitive_props detected" "priority_module" "$(cfg_get "conflict_sensitive_props" "")" || rc=1
  assert_eq "boot_hardening blocked" "0" "$(cfg_get "toggle_boot_hardening" 1)" || rc=1
  assert_eq "suspicious_props blocked" "0" "$(cfg_get "toggle_suspicious_props" 1)" || rc=1
  return $rc
}

# ============================================================
# RUN ALL
# ============================================================

tests=(
  tc01_no_conflicts
  tc02_passive_detected
  tc03_aggressive_detected
  tc04_both_types
  tc05_toggle_passive
  tc06_toggle_aggressive
  tc07_feature_should_run
  tc08_json_output
  tc09_yurikey
  tc10_integritybox
  tc11_invalid_choice
  tc12_resolve_idempotent
  tc13_action_toggles
  tc14_passive_sensitive_props
)

echo -e "${CYN}Conflict Resolution Test Suite${NC}"
echo "Base: $BASE"
echo ""

for test in "${tests[@]}"; do
  run_test "$test"
done

echo ""
echo "================================"
echo -e "Results: ${GRN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
echo "================================"
[ "$FAIL" -gt 0 ] && exit 1
exit 0
