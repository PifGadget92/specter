import { cfgGet, cfgSet } from './cfg.js';

let clockInterval = null;
let cachedFormat = 'auto';

export async function initClock() {
  const formatSelect = document.getElementById('clock-format-select');
  cachedFormat = await cfgGet('clock_format', 'auto') || 'auto';
  if (formatSelect) {
    formatSelect.value = cachedFormat;
    formatSelect.addEventListener('change', () => {
      cachedFormat = formatSelect.value;
      cfgSet('clock_format', cachedFormat);
    });
  }

  updateClock();
  clockInterval = setInterval(updateClock, 1000);
  window.addEventListener('beforeunload', destroyClock);
}

function destroyClock() {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
}

function updateClock() {
  const now = new Date();
  const dateEl = document.getElementById('clock-date');
  const timeEl = document.getElementById('clock-time');

  if (dateEl) dateEl.textContent = now.toLocaleDateString();
  if (timeEl) {
    if (cachedFormat === '24h') {
      timeEl.textContent = now.toLocaleTimeString('en-GB');
    } else if (cachedFormat === '12h') {
      timeEl.textContent = now.toLocaleTimeString('en-US', { hour12: true });
    } else {
      timeEl.textContent = now.toLocaleTimeString();
    }
  }
}
