import { showToast } from './toast.js';
import { ONLINE_ENDPOINTS } from './constants.js';
import { getTranslation } from './i18n.js';

let lastStatus: boolean | null = null;
let networkInterval: ReturnType<typeof setInterval> | null = null;

export function initNetwork() {
  updateNetworkStatus();
  networkInterval = setInterval(updateNetworkStatus, 15000);
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (networkInterval) clearInterval(networkInterval);
      networkInterval = null;
    } else if (!networkInterval) {
      updateNetworkStatus();
      networkInterval = setInterval(updateNetworkStatus, 15000);
    }
  });
  window.addEventListener('beforeunload', () => {
    if (networkInterval) clearInterval(networkInterval);
  });
}

async function updateNetworkStatus() {
  const online = await checkOnline();

  if (online === lastStatus) return;
  const wasOnline = lastStatus;
  lastStatus = online;

  const netChip     = document.getElementById('network-chip');
  const netAnnounce = document.getElementById('network-announce');

  const onlineText  = getTranslation('home_status_online') || 'Online';
  const offlineText = getTranslation('home_status_offline') || 'Offline';

  if (netChip) {
    const label = netChip.querySelector('#network-label');
    const icon = netChip.querySelector('md-icon');
    netChip.classList.toggle('offline', !online);
    if (label) label.textContent = online ? onlineText : offlineText;
    if (icon) icon.textContent = online ? 'wifi' : 'wifi_off';
  }
  if (netAnnounce) netAnnounce.textContent = online ? onlineText : offlineText;

  if (!online && wasOnline === true) {
    showToast(offlineText);
  }
}

async function checkOnline(): Promise<boolean> {
  if (!navigator.onLine) return false;
  for (const endpoint of ONLINE_ENDPOINTS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 800);
      await fetch(endpoint, { signal: ctrl.signal, mode: 'no-cors' });
      clearTimeout(timer);
      return true;
    } catch { /* try next endpoint */ }
  }
  return false;
}
