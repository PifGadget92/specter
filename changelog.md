# v1.4.1

## TEE Attestation
- **New TEE feature** (`features/tee.sh`) — runs TEE attestation via the Specter APK ContentProvider at boot, caching the result and hash. Falls back to computing the VBMeta digest from the vbmeta partition (including full chained digest via AVB chain partition descriptors + AVB footer support) when TEE is unavailable. Published to `ro.boot.vbmeta.digest` + `/data/adb/boot_hash`.
- **VBMeta helpers extracted** — `_val`, `emit_vbmeta`, `vbmeta_digest` moved into `lib/vbmeta.sh` as a reusable library. `tee.sh` now sources it as a consumer instead of defining the functions inline. Halved `tee.sh` from 132→63 lines.
- **Install-time TEE check removed** — `customize.sh` no longer downloads/installs the TEE check APK during module install; reads TEE status and hash from boot-time cache instead.
- **Boot core dispatches `tee` feature** in background alongside `rom_spoof`.

## Keybox
- **Custom keybox "No" path fixed** — selecting "No" (not a private keybox) no longer forces an extra detection dialog with catalog lookup + second confirmation. The keybox is installed directly, matching the "Yes" path behavior. Removed ~90 lines of dead detection dialog code.
- **Unused imports cleaned up** — `escapeHtml`, `closeToast` removed from keybox-ui.ts imports.

## Conflict System
- **TreatWheel reclassified** from `boot_hardening` → `prop_handler`. TreatWheel now defers prop spoofing, not boot hardening.
- **New `prop_handler` feature toggle** added to the boot-time feature list.
- **Aggressive-only override** — `boot_core.sh` only considers `aggressive` conflict type for the override description; passives no longer produce misleading conflict banners.

## Security Patch
- **Removed duplicate generate icon** — the trailing icon slot in the security patch dialog no longer has two overlapping buttons. Only the globe fetch icon remains.

## Boot
- **Fingerprint spoofing loop removed** from `spoof_build_props` — the per-prop fingerprint patching was redundant with the dedicated boot state props feature.
- **Delayed boot props** switched from raw `sp_try` calls to `apply_boot_props` for consistency.

## Device Info
- **Recovery folder detection** — device-info.sh now scans for TWRP/OrangeFox/FOX/PBRP/PitchBlack Recovery directories. WebUI shows/hides the recovery toggle row based on `recovery_detected` flag.

## Build & Misc
- **BusyBox standalone fix** — `action.sh` now only disables standalone mode under BusyBox; KSU's native ash is left untouched.
- **APK bundling** — `package.json` build step copies `src/apk/` into the module zip.
- **README** — added "Thanks" section with project credits.

# v1.4.0

## Performance
- **Init restructured** — page renders immediately with placeholders; all async I/O (device info, i18n, network checks, catalog fetch) runs fire-and-forget. No more 1-4s blank screen on slow devices.
- **Code splitting** — monolithic 490 KB material.ts split into 4 on-demand per-page chunks. Initial JS download reduced to ~84 KB (82% reduction).
- **CSS inlined** — no more render-blocking CSS download. Styles embedded directly in HTML.
- **Faster first paint** — core MWC now starts downloading in parallel with bridge/config init instead of after.
- **Native `<select>`** — replaced MWC md-outlined-select/md-select-option with native elements, eliminating the 120 KB select-option chunk.
- **Animation tuning** — page-enter transition set to 250ms (down from 350ms).
- **Unused imports removed** — md-sub-menu, md-list, md-list-item (3 unnecessary MWC component imports eliminated).
- **Duplicate button CSS removed** — custom .md3-tonal class replaced with standard md-filled-tonal-button.
- **Removed page-init.ts indirection** — simplified the dynamic import chain, one less round trip per tab switch.
- **Material Icons fonts non-blocking** — CDN stylesheets load with `media="print"` + `onload` swap, eliminating render blocking. Local `assets/material-icons.css` fallback on CDN failure.
- **Back button reworked** — first press goes Home, second press exits the WebUI.
- Lowered offline detection timeout from 2000ms to 800ms per endpoint.

## Theme
- **Theme flash eliminated** — inline `<script>` sets CSS custom properties before first paint. Theme colors cached in localStorage for instant correct colors on every subsequent visit.
- **Replace full MCU library with precomputed preset data** — the 97 KB @material/material-color-utilities library removed. 9 named presets now use a precomputed 7.5 KB lookup table of exact Google Material Design 3 hex values.
- **Monet wallpaper color matching** — Monet accent color is extracted and mapped to the closest named preset (red/orange/yellow/green/cyan/blue/purple/pink/grey) based on its HSL hue.
- **Grey preset fixed** — neutral seeds now produce true grey tones instead of the brown/cyan tint from HCT extraction artifacts.

## i18n
- **English strings inlined** — no network fetch needed for English locale.
- **Non-English caching** — translation files cached in localStorage. Repeat visits load instantly.
- **Duplicate lang file removed** from module zip (already inlined in JS).

## Device Info
- **Info cards cached** — device info cached in localStorage with 30-second TTL. Repeat visits show data instantly instead of `—`, with silent background refresh.

## Boot State Properties
- **Vendor boot props** — `vendor.boot.verifiedbootstate`, `vendor.boot.vbmeta.device_state`, `ro.vendor.boot.warranty_bit` now reset alongside `ro.boot.*` variants at boot.
- **Build flavor/fingerprint spoof** — `ro.build.flavor` patched (userdebug/eng → user), all `ro.*.build.fingerprint` patched (userdebug→user, test-keys→release-keys).
- **Realme specific** — `ro.boot.realmebootstate`, `ro.boot.realme.lockstate` set at boot.
- **Recovery bootmode hiding** — bootmode set to `unknown` when it contains "recovery".
- **Toggle added** — Boot State Props can be disabled in Control → Boot Behavior when needed.

## Security Patch
- **Fetch from source.android.com** — new globe button in the security patch dialog scrapes the latest Pixel security bulletin date directly from Google, instead of guessing "previous month".

## Suspicious Props
- **Backup before delete** — slain properties now backed up to `/data/adb/Specter/slain_props.prop` before removal.

## Build & Misc
- **CSS inlining** — build step automatically inlines the minified CSS into HTML.
- **Preconnect hints** added for rawbin.netlify.app in document `<head>`.
- **Module zip reduced** — 175 KB → 159 KB (9% smaller).

## Tools
- **Google Services section** added to Tools page — one-shot "Force Stop & Clear Play Store" button (gms.sh) restored.
- **Set target.txt one-shot button** restored under Tricky Store section.
