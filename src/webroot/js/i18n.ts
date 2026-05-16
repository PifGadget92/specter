import { cfgGet, cfgSet } from './cfg.js';
import { fetchJson } from './utils.js';
import enStrings from '../lang/source/string.json';

let currentStrings: Record<string, string> = {};
const fallbackStrings: Record<string, string> = enStrings;

export async function initI18n() {
  const saved = await cfgGet('lang', 'auto') || 'auto';
  let langCode: string;
  if (saved === 'auto') {
    const detected = (navigator.language || '').slice(0, 2);
    const available = ['en', 'zh', 'ru', 'es', 'ar'];
    langCode = available.includes(detected) ? detected : 'en';
  } else {
    langCode = saved;
  }
  await applyLanguage(langCode);
  wireLanguageSelect(langCode);
}

export async function applyLanguage(langCode: string) {
  if (langCode === 'en') {
    currentStrings = enStrings;
    applyTranslations();
    document.documentElement.dir = 'ltr';
    cfgSet('lang', langCode);
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: { langCode } }));
    return;
  }

  const cached = localStorage.getItem('i18n_' + langCode);
  if (cached) {
    try {
      currentStrings = JSON.parse(cached);
      applyTranslations();
    } catch (e) { /* ignore corrupt cache */ }
  }

  try {
    const res = await fetch(`lang/${langCode}.json?ts=${Date.now()}`);
    const data = await res.json();
    currentStrings = data;
    applyTranslations();
    localStorage.setItem('i18n_' + langCode, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to load language:', e);
    if (!cached) currentStrings = {};
  }

  document.documentElement.dir = langCode === 'ar' ? 'rtl' : 'ltr';
  cfgSet('lang', langCode);
  document.dispatchEvent(new CustomEvent('languageChanged', { detail: { langCode } }));
}

export function getTranslation(key: string): string | null {
  return currentStrings[key] || fallbackStrings[key] || null;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = (el as HTMLElement).dataset.i18n;
    if (!key) return;

    if (el.tagName === 'TITLE') {
      const val = currentStrings[key] || fallbackStrings[key];
      if (val) document.title = val;
      return;
    }

    const val = currentStrings[key] || fallbackStrings[key];
    if (!val) return;

    if (el.tagName === 'MD-NAVIGATION-TAB' || el.tagName === 'MD-ASSIST-CHIP' || el.tagName === 'MD-FILTER-CHIP') {
      (el as any).label = val;
      setAriaLabel(el, val);
      return;
    }

    if (val.includes('<')) {
      el.innerHTML = val;
    } else {
      while (el.firstChild) el.removeChild(el.firstChild);
      el.appendChild(document.createTextNode(val));
    }
  });

  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = (el as HTMLElement).dataset.i18nAria;
    if (!key) return;
    const val = currentStrings[key] || fallbackStrings[key];
    if (val) setAriaLabel(el, val);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = (el as HTMLElement).dataset.i18nPlaceholder;
    if (!key) return;
    const val = currentStrings[key] || fallbackStrings[key];
    if (val) (el as any).placeholder = val;
  });

  document.querySelectorAll('md-filter-chip[data-preset]').forEach(chip => {
    const preset = (chip as HTMLElement).dataset.preset;
    if (!preset) return;
    const key = 'theme_preset_' + preset;
    const val = currentStrings[key] || fallbackStrings[key];
    if (val) (chip as any).label = val;
  });
}

function setAriaLabel(el: Element, val: string) {
  if (el.hasAttribute('aria-label')) {
    el.setAttribute('aria-label', val);
  }
}

function wireLanguageSelect(currentLang: string) {
  const select = document.getElementById('language-select') as HTMLSelectElement | null;
  if (!select) return;

  const LANGUAGES: [string, string, string][] = [
    ['en', '🇬🇧', 'English'],
    ['zh', '🇨🇳', '中文'],
    ['ru', '🇷🇺', 'Русский'],
    ['es', '🇪🇸', 'Español'],
    ['ar', '🇸🇦', 'العربية'],
  ];

  LANGUAGES.forEach(([code, flag, name]) => {
    const item = document.createElement('option');
    item.value = code;
    item.textContent = `${flag} ${name}`;
    select.appendChild(item);
  });

  select.value = currentLang;

  select.addEventListener('change', async () => {
    try {
      await applyLanguage(select.value);
    } catch (e) {
      console.warn('Language change failed:', e);
    }
  });
}
