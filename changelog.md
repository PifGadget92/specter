# v1.4.0

## ⚡ Performance
- **Init restructured** — page renders immediately with placeholders; all async I/O (device info, i18n, network checks, catalog fetch) runs fire-and-forget. No more 1-4s blank screen on slow devices.
- **Code splitting** — monolithic 490 KB material.ts split into 4 on-demand per-page chunks. Initial JS download reduced to ~84 KB (82% reduction).
- **CSS inlined** — no more render-blocking CSS download. Styles embedded directly in HTML.
- **Faster first paint** — core MWC now starts downloading in parallel with bridge/config init instead of after.
- **Native `<select>`** — replaced MWC md-outlined-select/md-select-option with native elements, eliminating the 120 KB select-option chunk.
- **Animation tuning** — page-enter transition set to 250ms (down from 350ms).
- **Unused imports removed** — md-sub-menu, md-list, md-list-item (3 unnecessary MWC component imports eliminated).
- **Duplicate button CSS removed** — custom .md3-tonal class replaced with standard md-filled-tonal-button.
- **Removed page-init.ts indirection** — simplified the dynamic import chain, one less round trip per tab switch.
- **Material Icons fonts served locally** — no CDN requests for icon CSS, no render-blocking on slow networks.
- **Back button reworked** — first press goes Home, second press exits the WebUI.
- Lowered offline detection timeout from 2000ms to 800ms per endpoint.

## 🎨 Theme
- **Theme flash eliminated** — inline `<script>` sets CSS custom properties before first paint. Theme colors cached in localStorage for instant correct colors on every subsequent visit.
- **Replace full MCU library with precomputed preset data** — the 97 KB @material/material-color-utilities library removed. 9 named presets now use a precomputed 7.5 KB lookup table of exact Google Material Design 3 hex values.
- **Monet wallpaper color matching** — Monet accent color is extracted and mapped to the closest named preset (red/orange/yellow/green/cyan/blue/purple/pink/grey) based on its HSL hue.
- **Grey preset fixed** — neutral seeds now produce true grey tones instead of the brown/cyan tint from HCT extraction artifacts.

## 🌐 i18n
- **English strings inlined** — no network fetch needed for English locale.
- **Non-English caching** — translation files cached in localStorage. Repeat visits load instantly.
- **Duplicate lang file removed** from module zip (already inlined in JS).

## ⏱ Device Info
- **Info cards cached** — device info cached in localStorage with 30-second TTL. Repeat visits show data instantly instead of `—`, with silent background refresh.

## 🏗 Build & Misc
- **CSS inlining** — build step automatically inlines the minified CSS into HTML.
- **Preconnect hints** added for rawbin.netlify.app in document `<head>`.
- **Module zip reduced** — 175 KB → 159 KB (9% smaller).
