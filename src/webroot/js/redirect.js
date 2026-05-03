import { shellEscape } from './utils.js';

const ALLOWED_HOSTS = [
  'github.com',
  't.me',
  'telegram.me',
];

export function initRedirect() {
  document.querySelectorAll('[data-url]').forEach(el => {
    el.addEventListener('click', () => openUrl(el.dataset.url));
  });
}

export function openUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch { /* URL parse fallback */
    return;
  }

  if (!['https:', 'http:'].includes(url.protocol)) return;
  if (!ALLOWED_HOSTS.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) return;

  if (window.ksu?.exec) {
    window.__redirect_cb = window.__redirect_cb || function() {};
    window.ksu.exec(
      `am start -a android.intent.action.VIEW -d ${shellEscape(url.href)}`,
      '{}',
      '__redirect_cb'
    );
  } else {
    window.open(url.href, '_blank');
  }
}
