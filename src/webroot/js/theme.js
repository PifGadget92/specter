import { CorePalette, Scheme } from '@material/material-color-utilities';
import { cfgGet, cfgSet } from './cfg.js';

const PRESETS = {
  ocean:  '#1B6EF3',
  rose:   '#C2184B',
  forest: '#1B6E3A',
  sunset: '#E65100',
  violet: '#6750A4',
};

let currentPreset = 'ocean';
let currentSeed = null;

export async function initTheme(savedMode) {
  const preset = await cfgGet('theme_preset', 'monet') || 'monet';
  currentPreset = preset;
  const mode = savedMode || 'dark';

  await customElements.whenDefined('md-filter-chip');
  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.selected = chip.dataset.preset === preset;
  });

  if (preset === 'monet') {
    await applyMonetPreset(mode);
  } else {
    applyMode(mode);
  }

  wireThemeControls();
}

async function extractMonetColor() {
  try {
    const { exec } = await import('./bridge.js');

    const commands = [
      `cmd overlay lookup com.android.systemui android:color/system_accent1_500 2>/dev/null`,
      `settings get secure monet_engine_seed 2>/dev/null`,
      `getprop persist.sys.theme.color 2>/dev/null`,
      `dumpsys wallpaper 2>/dev/null | grep -oE '0x[0-9a-fA-F]{8}' | head -1 | tr -d '\\n'`,
    ];

    for (const cmd of commands) {
      const { stdout } = await exec(cmd);
      const hex = stdout?.trim();
      if (!hex) continue;

      let argb;
      if (/^0x[0-9a-fA-F]{8}$/.test(hex)) {
        argb = parseInt(hex, 16);
      } else if (/^#[0-9a-fA-F]{8}$/.test(hex)) {
        argb = parseInt(hex.slice(1), 16);
      } else if (/^#?[0-9a-fA-F]{6}$/.test(hex.replace('#', ''))) {
        argb = parseInt(hex.replace('#', ''), 16) | 0xFF000000;
      } else if (/^\d+$/.test(hex) && hex.length > 6) {
        argb = parseInt(hex, 10);
      }

      if (argb && !isNaN(argb)) {
        const seed = '#' + (argb & 0x00FFFFFF).toString(16).padStart(6, '0');
        if (seed !== '#000000') return seed;
      }
    }
  } catch (e) {
    console.warn('Failed to extract monet color:', e);
  }
  return null;
}

async function applyMonetPreset(mode) {
  let seed = await cfgGet('monet_seed', null);
  if (!seed) {
    seed = await extractMonetColor();
    if (seed) {
      cfgSet('monet_seed', seed);
    } else {
      seed = PRESETS.ocean;
    }
  }
  currentSeed = seed;

  const resolved = mode === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  document.documentElement.setAttribute('data-theme-preset', 'monet');
  cfgSet('theme_preset', 'monet');
  generateScheme(seed, resolved === 'dark');
}

function applyMode(mode) {
  const resolved = mode === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  document.documentElement.setAttribute('data-theme', mode);
  document.documentElement.setAttribute('data-theme-resolved', resolved);
  document.documentElement.style.colorScheme = resolved;
  cfgSet('theme', mode);
  const group = document.getElementById('theme-mode-group');
  if (group) {
    group.querySelectorAll('md-outlined-segmented-button').forEach(btn => {
      btn.selected = btn.getAttribute('value') === mode;
    });
  }

  const seed = currentPreset === 'monet' ? currentSeed : PRESETS[currentPreset];
  generateScheme(seed, resolved === 'dark');
}

function applyPreset(preset) {
  if (preset === 'monet') {
    document.querySelectorAll('.preset-chip').forEach(chip => {
      chip.selected = chip.dataset.preset === 'monet';
    });
    applyMonetPreset(document.documentElement.getAttribute('data-theme') || 'dark');
    return;
  }
  const seed = PRESETS[preset];
  if (!seed) return;
  currentSeed = null;
  currentPreset = preset;
  document.documentElement.setAttribute('data-theme-preset', preset);
  cfgSet('theme_preset', preset);
  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.selected = chip.dataset.preset === preset;
  });
  const resolved = document.documentElement.getAttribute('data-theme-resolved') === 'dark';
  generateScheme(seed, resolved);
}

function generateScheme(seed, isDark) {
  if (!seed) return;
  const argb = parseInt(seed.slice(1), 16) | 0xFF000000;
  const scheme = isDark ? Scheme.dark(argb) : Scheme.light(argb);
  const props = scheme.toJSON();

  const core = CorePalette.contentOf(argb);
  const n1 = core.n1;
  if (isDark) {
    props.surfaceContainerLowest = n1.tone(4);
    props.surfaceContainerLow = n1.tone(10);
    props.surfaceContainer = n1.tone(12);
    props.surfaceContainerHigh = n1.tone(17);
    props.surfaceContainerHighest = n1.tone(22);
  } else {
    props.surfaceContainerLowest = n1.tone(100);
    props.surfaceContainerLow = n1.tone(96);
    props.surfaceContainer = n1.tone(94);
    props.surfaceContainerHigh = n1.tone(92);
    props.surfaceContainerHighest = n1.tone(90);
  }

  const root = document.documentElement;
  for (const [key, value] of Object.entries(props)) {
    const cssKey = '--md-sys-color-' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
    root.style.setProperty(cssKey, '#' + (value & 0x00FFFFFF).toString(16).padStart(6, '0'));
  }
}

function wireThemeControls() {
  const modeGroup = document.getElementById('theme-mode-group');
  modeGroup?.addEventListener('segmented-button-set-selection', (e) => {
    const idx = e.detail.index;
    const btn = modeGroup.querySelectorAll('md-outlined-segmented-button')[idx];
    if (btn) applyMode(btn.getAttribute('value'));
  });

  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', async () => applyPreset(chip.dataset.preset));
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const mode = document.documentElement.getAttribute('data-theme');
    if (mode === 'auto') {
      const resolved = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme-resolved', resolved);
      document.documentElement.style.colorScheme = resolved;
      applyMode('auto');
    }
  });
}
