import { cfgGet, cfgSet } from './cfg.js';

let currentStrings = {};
let fallbackStrings = {};

export async function initI18n() {
  try {
    const res = await fetch(`lang/source/string.json?ts=${Date.now()}`);
    fallbackStrings = await res.json();
  } catch { fallbackStrings = {}; } /* fetch/parse fallback */

  const saved = await cfgGet('lang', 'en') || 'en';
  await applyLanguage(saved, true);
  wireLanguageSelect(saved);
}

export async function applyLanguage(langCode) {
  const url = langCode === 'en'
    ? `lang/source/string.json?ts=${Date.now()}`
    : `lang/${langCode}.json?ts=${Date.now()}`;

  try {
    const res = await fetch(url);
    currentStrings = await res.json();
  } catch { /* fetch/parse fallback */
    currentStrings = {};
  }

  applyTranslations();
  cfgSet('lang', langCode);
  document.documentElement.dir = langCode === 'ar' ? 'rtl' : 'ltr';
  document.dispatchEvent(new CustomEvent('languageChanged', { detail: { langCode } }));
}

export function getTranslation(key) {
  return currentStrings[key] || fallbackStrings[key] || null;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;

    if (el.tagName === 'TITLE') {
      const val = currentStrings[key] || fallbackStrings[key];
      if (val) document.title = val;
      return;
    }

    const val = currentStrings[key] || fallbackStrings[key];
    if (!val) return;

    if (el.tagName === 'MD-NAVIGATION-TAB' || el.tagName === 'MD-ASSIST-CHIP' || el.tagName === 'MD-FILTER-CHIP') {
      el.label = val;
      return;
    }

    if (val.includes('<')) {
      el.innerHTML = val;
    } else {
      while (el.firstChild) el.removeChild(el.firstChild);
      el.appendChild(document.createTextNode(val));
    }
  });

  document.querySelectorAll('md-filter-chip[data-preset]').forEach(chip => {
    const preset = chip.dataset.preset;
    const key = 'theme_preset_' + preset;
    const val = currentStrings[key] || fallbackStrings[key];
    if (val) chip.label = val;
  });
}

function wireLanguageSelect(currentLang) {
  const select = document.getElementById('language-select');
  if (!select) return;

  Promise.all([
    customElements.whenDefined('md-outlined-select'),
    customElements.whenDefined('md-select-option'),
  ]).then(async () => {

  const LANGUAGES = [
    ['en', '🇬🇧', 'English'],
    ['zh', '🇨🇳', '中文'],
    ['ru', '🇷🇺', 'Русский'],
    ['es', '🇪🇸', 'Español'],
    ['pt', '🇵🇹', 'Português'],
    ['hi', '🇮🇳', 'हिन्दी'],
    ['ar', '🇸🇦', 'العربية'],
    ['fr', '🇫🇷', 'Français'],
    ['de', '🇩🇪', 'Deutsch'],
    ['tr', '🇹🇷', 'Türkçe'],
  ];

  LANGUAGES.forEach(([code, flag, name]) => {
    const item = document.createElement('md-select-option');
    item.value = code;
    const headline = document.createElement('div');
    headline.slot = 'headline';
    headline.textContent = `${flag} ${name}`;
    item.appendChild(headline);
    item.addEventListener('click', async () => {
      try {
        await applyLanguage(code);
        select.value = code;
      } catch (e) {
        console.warn('Language change failed:', e);
      }
    });
    select.appendChild(item);
  });

  await new Promise(r => requestAnimationFrame(r));
  select.value = currentLang;
  });
}
