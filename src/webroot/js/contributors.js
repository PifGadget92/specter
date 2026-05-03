import { escapeHtml } from './utils.js';
import { getTranslation } from './i18n.js';

export async function loadContributors() {
  const grid = document.getElementById('contributors-grid');
  if (!grid) return;

  let devs = [];
  try {
    const res = await fetch(`json/dev.json?ts=${Date.now()}`);
    devs = await res.json();
  } catch {
    console.warn('Failed to load contributors');
    return;
  }

  grid.innerHTML = devs.map(dev => `
    <md-outlined-card class="contributor-card"
               data-url="${encodeURI(dev.github || '')}">
      <img class="contributor-avatar"
           src="${escapeHtml(dev.avatar || '')}"
           alt="${escapeHtml(dev.name)}"
           loading="lazy"
           onerror="this.src='assets/icon.png'" />
      <p class="md-typescale-label-large contributor-name">
        ${escapeHtml(dev.name)}
      </p>
      <p class="md-typescale-label-small contributor-role">
        ${escapeHtml(getTranslation('role_' + dev.role) || dev.role)}
      </p>
    </md-outlined-card>
  `).join('');

  grid.querySelectorAll('[data-url]').forEach(card => {
    card.addEventListener('click', async () => {
      const { openUrl } = await import('./redirect.js');
      openUrl(decodeURI(card.dataset.url));
    });
  });
}
