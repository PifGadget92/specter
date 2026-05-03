const INFO_URL = '/json/info.json';
const KEYBOX_INFO_URL = '/json/keybox_info.json';

let bridge = null;
let infoCache = null;
async function getBridge() {
  if (!bridge) bridge = await import('./bridge.js');
  return bridge;
}

export async function initDevice() {
  await loadDeviceInfo();
  refreshDevice();
  await loadVersion();
  refreshKeyboxStatus();
}

export async function refreshDevice() {
  const { runScript } = await getBridge();
  try {
    const result = await runScript('device-info.sh', 'common');
    if (result.output) {
      const { appendToOutput } = await import('./terminal.js');
      result.output.split('\n').filter(Boolean).forEach(l => appendToOutput(`[device-info] ${l}`));
    }
  } catch (e) {
    console.warn('Device info script failed:', e);
  }
  await waitForValidDeviceInfo();
}

export async function refreshKeyboxStatus() {
  const { runScript } = await getBridge();
  try {
    const result = await runScript('keybox_info.sh', 'feature');
    if (result.output) {
      const { appendToOutput } = await import('./terminal.js');
      result.output.split('\n').filter(Boolean).forEach(l => appendToOutput(`[keybox] ${l}`));
    }
  } catch (e) {
    console.warn('Keybox info script failed:', e);
  }
  await waitForKeyboxInfo();
  await loadKeyboxStatus();
}

async function fetchDeviceInfo() {
  const res = await fetch(`${INFO_URL}?ts=${Date.now()}`);
  const data = await res.json();
  if (data.android || data.kernel || data.root) {
    infoCache = data;
    return data;
  }
  throw new Error('empty');
}

async function loadDeviceInfo() {
  try {
    const data = await fetchDeviceInfo();
    applyDeviceInfo(data);
  } catch (e) {
    console.warn('Fetch device info failed:', e);
  }
}

async function waitForValidDeviceInfo(maxMs = 6000, intervalMs = 400) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const data = await fetchDeviceInfo();
      applyDeviceInfo(data);
      return;
    } catch (e) {
      console.warn('Poll device info failed:', e);
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

function applyDeviceInfo(data) {
  setText('android-value', data.android || '—');
  setText('kernel-value', data.kernel || '—');
  setText('root-value', data.root || '—');
}

async function loadVersion() {
  try {
    let data;
    if (infoCache && infoCache.version) {
      setText('version-info-value', infoCache.version);
      return;
    }
    const res = await fetch(`${INFO_URL}?ts=${Date.now()}`);
    data = await res.json();
    if (data.version) setText('version-info-value', data.version);
  } catch (e) {
    console.warn('Version fetch failed:', e);
  }
}

async function fetchKeyboxInfo() {
  const res = await fetch(`${KEYBOX_INFO_URL}?ts=${Date.now()}`);
  return await res.json();
}

async function waitForKeyboxInfo(maxMs = 6000, intervalMs = 300) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const data = await fetchKeyboxInfo();
      if ('installed' in data) return;
    } catch (e) {
      console.warn('Poll keybox info failed:', e);
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

async function loadKeyboxStatus() {
  try {
    const data = await fetchKeyboxInfo();
    applyKeyboxStatus(data);
  } catch (e) {
    console.warn('Keybox status fetch failed:', e);
  }
}

function applyKeyboxStatus(data) {
  const source = document.getElementById('keybox-source');
  const statusEl = document.getElementById('keybox-status');
  const icon = document.getElementById('keybox-icon');
  if (!source || !statusEl || !icon) return;

  if (!data.installed) {
    source.textContent = 'Not Installed';
    source.className = 'keybox-chip keybox-chip--neutral';
    statusEl.style.display = 'none';
    icon.textContent = 'vpn_key_off';
    return;
  }

  statusEl.style.display = '';

  if (data.source) {
    const name = data.source.charAt(0).toUpperCase() + data.source.slice(1);
    const label = data.text ? `${name} ${data.text}` : name;
    if (data.up_to_date) {
      source.textContent = label + ' \u00B7 Latest';
      source.className = 'keybox-chip keybox-chip--yuri';
      icon.textContent = 'verified_user';
    } else {
      source.textContent = label;
      source.className = 'keybox-chip keybox-chip--outdated';
      icon.textContent = 'system_update';
    }
  } else {
    source.textContent = 'Generic';
    source.className = 'keybox-chip keybox-chip--neutral';
    icon.textContent = 'key';
  }

  if (data.revoked) {
    statusEl.textContent = 'Revoked';
    statusEl.className = 'keybox-chip keybox-chip--revoked';
  } else {
    statusEl.textContent = 'Active';
    statusEl.className = 'keybox-chip keybox-chip--active';
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
