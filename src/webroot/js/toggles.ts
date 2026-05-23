import { cfgGet, cfgSet, cfgInvalidate } from './cfg.js';
import { CONTROL_TOGGLES } from './constants.js';
import { getTranslation } from './i18n.js';
import { showToast } from './toast.js';
import { setDevMode } from './state.js';

const t = (key: string, fallback: string): string => getTranslation(key) || fallback;

export function wireControlToggles() {
  for (const { id, key, default: def } of CONTROL_TOGGLES) {
    const sw = document.getElementById(id) as MdSwitch | null;
    if (!sw) continue;
    cfgGet(key, def || '1').then(val => { sw.selected = val !== '0'; });
    sw.addEventListener('change', () => {
      cfgSet(key, sw.selected ? '1' : '0');
    });
  }
}

export async function refreshControlToggles() {
  cfgInvalidate();
  for (const { id, key, default: def } of CONTROL_TOGGLES) {
    const sw = document.getElementById(id) as MdSwitch | null;
    if (!sw) continue;
    const val = await cfgGet(key, def || '1');
    sw.selected = val !== '0';
  }
}

export function wireDevMode() {
  const sw = document.getElementById('dev-mode-switch') as MdSwitch | null;
  if (!sw) return;
  sw.addEventListener('change', () => {
    setDevMode(sw.selected);
    cfgSet('dev_mode', sw.selected ? 'true' : 'false');
  });
}
