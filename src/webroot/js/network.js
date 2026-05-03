import { showToast } from './toast.js';
import { ONLINE_ENDPOINTS } from './constants.js';
import { getTranslation } from './i18n.js';

let lastStatus = null;
let networkInterval = null;

export function initNetwork() {
  updateNetworkStatus();
  networkInterval = setInterval(updateNetworkStatus, 3000);
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
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

  if (online) {
    netChip?.classList.remove('offline');
    if (netChip) {
      const label = netChip.querySelector('#network-label');
      if (label) label.textContent = onlineText;
      const icon = netChip.querySelector('md-icon');
      if (icon) icon.textContent = 'wifi';
    }
    if (netAnnounce) netAnnounce.textContent = onlineText;
  } else {
    netChip?.classList.add('offline');
    if (netChip) {
      const label = netChip.querySelector('#network-label');
      if (label) label.textContent = offlineText;
      const icon = netChip.querySelector('md-icon');
      if (icon) icon.textContent = 'wifi_off';
    }

    if (netAnnounce) netAnnounce.textContent = offlineText;

    if (wasOnline === true) {
      showToast(offlineText);
    }
  }
}

async function checkOnline() {
  if (!navigator.onLine) return false;
  for (const endpoint of ONLINE_ENDPOINTS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2000);
      await fetch(endpoint, { signal: ctrl.signal, mode: 'no-cors' });
      clearTimeout(timer);
      return true;
    } catch { /* try next endpoint */ }
  }
  return false;
}
