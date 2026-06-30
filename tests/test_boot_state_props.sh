plan "boot_state_props.sh — bootmode spoofing under bootmode_spoof toggle"

# ---- bootmode: set to "normal" when bootmode_spoof enabled ----
bootstrap
source_libs
set_cfg "bootmode_spoof" "1"
set_prop "ro.bootmode" "recovery"

_do_bootmode=$(cfg_get bootmode_spoof 1)
if [ "$_do_bootmode" != "0" ]; then
  sp_try "ro.bootmode" "normal"
fi

assert_prop_eq "bootmode_spoof: ro.bootmode → normal" "ro.bootmode" "normal"

# ---- bootmode: unchanged when bootmode_spoof disabled ----
bootstrap
source_libs
set_cfg "bootmode_spoof" "0"
set_prop "ro.bootmode" "recovery"

_do_bootmode=$(cfg_get bootmode_spoof 1)
if [ "$_do_bootmode" != "0" ]; then
  sp_try "ro.bootmode" "normal"
fi

assert_prop_eq "bootmode_spoof: disabled, stays recovery" "ro.bootmode" "recovery"

done_testing
