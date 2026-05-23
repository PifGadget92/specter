# v1.4.1

## Control System Fixes
- **Recovery toggle**: ON now runs `hide_recovery_folders()` correctly
- **Toggle switch writes fixed**: `sw.toggleAttribute` → `sw.selected` so `md-switch` fires `change` events
- **Action pipeline config path**: `action.sh` sources `lib/paths.sh` so `$CONFIG_DIR` resolves
- **Keybox detection fixed**: removed `check_network` gate and `set -e` from `keybox_info.sh`
- **Catalog serial format**: added `printf '%u'` hex→decimal conversion; matching loop tries both
- **Multi-cert decode fixed**: `/-----END CERTIFICATE-----/q` stops after first cert; base64 whitespace stripped
- **Keybox status stale**: `keybox.sh` calls `keybox_info.sh` after install; WebUI calls `refreshKeyboxStatus()`
- **Config simplified**: removed `ksud module config` fallback; `.val` files only
- **Conflict system**: `apply_conflict_toggles()` deleted; conflicts write `conflict_*` keys only
- **Action pipeline**: `set -e` removed; each step guarded with `|| true`
- **Delayed spoofing**: gated on recovery toggle via `_feature_should_run()`

## Boot & TEE
- **One-time boot markers**: tee and ROM spoof cleanup run once after install
- **Boot feature list trimmed**: dispatches recovery, boot_hardening, suspicious_props, lsposed only
- **TEE attestation**: moved to boot via APK ContentProvider with cached status + hash
- **target.txt merges** missing apps instead of overwriting; order preserved

## Keybox
- **Softbanned status**: new `softbanned` boolean; `findWorking()` and raw serving exclude softbanned
- **Auto-override**: `POST /set-auto-override` and `/clear-auto-override` endpoints
- **Set-status endpoint**: `POST /catalog/set-status` replaces toggle-softban; checks Google revocation
- **Three-state chip**: Active/Softbanned/Revoked with dropdown

## Module Description
- **Dynamic description**: manager apps show live keybox source, revocation, app count, patch date
- **Real-time refresh**: recomputed on keybox install, target edit, or patch change
- **Tricky Store/conflict detection** shown in description
- **`refresh_desc.sh`** for on-demand refresh; WebUI calls it after writes

## Other
- APK bundling; Suspicious Props toggle added to UI; USB debugging code removed; TEE APK self-removes

# v1.4.0

## Performance
- **Page renders instantly**: placeholders, code splitting (490KB→4 chunks), inlined CSS, parallel MWC download
- **Native `<select>`**: eliminated 120KB MWC select chunk
- **Back button**: first press Home, second exits
- **Offline detection**: 2000ms→800ms

## Theme
- **Theme flash eliminated**: inline script sets CSS vars before first paint; cached in localStorage
- **MCU library replaced**: 97KB → 7.5KB lookup table; Monet accent mapped to closest preset

## i18n
- **English strings inlined**; non-English cached in localStorage

## Boot State Properties
- **Vendor boot props** reset alongside `ro.boot.*`; `ro.build.flavor` spoofed; Realme props added
- **Recovery bootmode** masked; toggle added to Control

## Other
- Security Patch fetched from source.android.com; suspicious props backed up before delete
- Google Services section in Tools; module zip 175KB→159KB

# v1.3.3

## Features
- **Dynamic module description**: priority-based status line (keybox, revocation, apps, patch)
- **One-time TEE check**: APK downloaded, run, self-deletes after caching result
- **"Fix PIF Detection" button restored**: boot function only set guard props — `block_rom_spoof_engines()` now actively removes `pihook`/`pixelprops`

## Boot Refactor
- **`apply_boot_props()`**: early boot only, no AVB override, Magisk-only
- **Unified boot logic**: `lib/boot_core.sh` for both `service.sh` and `boot-completed.sh`
- **`_feature_should_run()`**: single toggle+conflict gate
- **Feature scripts extracted**: `boot_hardening.sh`, `bootloader_spoofer.sh`, `rom_spoof.sh`
- **Toggle/LSPosed/recovery/hardening fixes** for KSU and Magisk parity

## Installer
- **Module detection**: reads module.prop for variant; consolidated `detect_root_solution()`
- **Conflict registry**: extracted to `config/conflicts.txt`

## Other
- 14 conflict tests; `twrp.sh`→`recovery.sh`; dead code removed

# v1.3.2

## Conflict Type System
- **Aggressive vs passive**: aggressive (TSupport, Yurikey, IntegrityBox) renamed to `.bak`; passive (TreatWheel, NoHello, SensitiveProps) coexist with deferred toggles
- **`_conflict_claimed()`** honors priority choice; passive skips rename, only recalculates toggles
- **Treat Wheel**: corrected from 3 features to just `boot_hardening`
- **Sensitive Props**: corrected from 3 features to `boot_hardening`, `suspicious_props`

## Other
- TEE status detection: reads both `tee_status` and `tee_status.txt` formats
- `disable_dev_options()` removed; all vol-key conflict prompts removed (fully automatic)

# v1.3.1

## WebUI Restructure
- **app.ts split**: 844→140 lines; 5 domain modules extracted
- **target-apps.ts**: 7 mutable vars eliminated, state local to closure

## Performance
- **Batch config init**: single exec reads all `.val` files (~15× fewer round trips)
- **HTTP fetch cache**: TTL-based; network polling 3s→15s

## APatch / KSU
- **`download()` PATH**: added `/data/adb/ap/bin:/data/adb/ksu/bin` for busybox
- **Keybox fallback**: real provider URLs, `download()` instead of `--spider`

## Type Safety
- **17 MDC elements typed**: ~60 `as any` eliminated; dialog factory; zero type errors

## Other
- System fallback for security patch; nav bar indicator fixed; responsive browse button

# v1.3.0

## VBMeta / Boot Hash
- **`read_vbmeta()` removed**: raw partition SHA-256 was incorrect
- **`boot_hash.sh` rewritten**: system prop → `/proc/cmdline` → user config → stored file; no zero fallback
- **`/proc/cmdline` source**: bootloader digest survives module interference

## Installer
- **Timeout on vol-key prompts** (8s default); download timeout guard (30s)

## New Features
- **Interactive App Targeting overlay**: full M3 sub-page, 4-state cycling, blacklist mode, DenyList import
- **App Catalog management**: CRUD, sortable, JSON import/export
- **Security Patch dialog**: M3 date input with auto-generate
- **Binary-level prop deletion**: `hexpatch_deleteprop()` via magickboot
- **Periodic suspicious props re-cleaning** (hourly)
- **File permission hardening**: /proc/cmdline, /proc/net/unix, install-recovery.sh, addon.d

## Conflict Resolution
- **`apply_conflict_toggles()`** writes both `toggle_*` and `toggle_action_*`
- **NoHello narrowed**: 7→1 feature; `refreshControlToggles()` missing recovery entry fixed
- **New registry entries**: Sensitive Props, Yurikey, Integrity Box

## i18n
- **All 4 translations** synced to 180 keys; 24 missing Control keys added; 26 new keys

## Removed Features
- **`boot_hash.sh` removed**: boot hash is automatic
- **`pif2.sh` removed**: boot-time `block_rom_spoof_engines` covers it
- **SmartMerge removed**: replaced by App Targeting overlay
- **WebUI tab persistence removed**: always opens Home

## Other
- PIF default off; `post-fs-data.sh` for early conflict resolution; hex→decimal serial safety

# v1.2.0

## Feature Toggle System
- **Control page**: per-feature toggles for boot behavior and action pipeline; values stored as `.val` files

## Conflict Resolution System
- **Data-driven registry**: single source of truth; adding a module is one entry
- **`apply_conflict_toggles()`**: auto-enables/disables based on priority
- **Config migration**: old conflict files migrated; backup system for uninstall
- **WebUI integration**: `conflicts.sh` exposes JSON; toggles refresh live

## WebUI
- **Setup + Maintain merged** into Tools (5→4 tabs); old hashes auto-migrate
- **Dialogs rewritten per M3 spec**: no inline styles, proper ARIA

## Other
- No forced target.txt on install; action pipeline individually gated
- `gms.sh` kills droidguard by name pattern; `target.sh` uses `_is_teesimulator`
- `docs/CONFLICTS.md` added; README simplified

# v1.1.0

- **GMS stability**: no multi-package force-stop (caused logouts); Play Store-only kill
- **Property system**: `sp_try()` replaces `resetprop_if_diff`/`resetprop_if_match`; `sp_persist()` replaces `persistprop`
- **New scripts**: `kill_play_store.sh`, `suspicious_props.sh`, `package_list.sh`
- **`post-fs-data.sh` merged** into `service.sh`
- **WebUI navigation**: Actions/Adevanced/Keybox/Tools → Home/Setup/Maintain/Settings; Danger Zone added
- **URL hash routing** with popstate; tab persistence; RTL centering
- **Logging**: 16/18 scripts follow `[TAG] Start/Finish` pattern

# v1.0.0

- **Rebranded from Yurikey to Specter**
- **Architecture**: vanilla JS → strict TypeScript + Vite; BeerCSS → MWC; static colors → Material Color Utilities + Monet
- **Pipeline orchestration** via `orchestrator.sh`; shared `lib/common.sh`; config via `ksud module config`
- **Keybox**: Google revocation checking, multi-source catalog, custom install, status card, backup/restore
- **~40+ boot props** with delayed spoofing; VBMeta from block device; CROM hook detection
- **16 modular feature scripts**, multi-root support (Magisk/KSU/APatch)
- **WebUI**: M3 pill nav, 5 languages, 9 color presets, dark/light/auto, page transitions
- **CI/CD**: GitHub Actions, TS checking, automated module zip + update.json
