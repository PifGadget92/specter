plan "pif prop read order follows the installed variant"

bootstrap
source_libs
. "$REPO_ROOT/src/lib/pif_preferred.sh"

assert_eq "no module keeps legacy file first" "/data/adb/pif.prop" "$(pif_prop_candidates | sed -n 1p)"

mk_module playintegrityfix "Play Integrity Fix [INJECT]"
assert_eq "inject reads legacy file first" "/data/adb/pif.prop" "$(pif_prop_candidates | sed -n 1p)"

mk_module playintegrityfix "Play Integrity Fork"
assert_eq "fork reads its own file first" "$PIF_DIR/custom.pif.prop" "$(pif_prop_candidates | sed -n 1p)"
assert_eq "fork keeps legacy file as fallback" "/data/adb/pif.prop" "$(pif_prop_candidates | sed -n 2p)"

_dupes=$(pif_prop_candidates | sort | uniq -d | wc -l | tr -d ' ')
assert_eq "no duplicate candidates" "0" "$_dupes"

for _reader in "$REPO_ROOT/src/webroot/common/device-info.sh" \
               "$REPO_ROOT/src/features/setup_info_shell.sh"; do
  if grep -q 'pif_prop_candidates' "$_reader"; then
    ok "reader takes order from helper: ${_reader##*/}"
  else
    fail "reader takes order from helper: ${_reader##*/}" "hardcoded candidate list"
  fi
done

done_testing
