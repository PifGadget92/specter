import './material.js';
import { initBridge, spawnScript, getModuleDir as getBridgeModuleDir } from './bridge.js';
import { setModuleDir, migrateLocalStorage, cfgGet, cfgSet } from './cfg.js';
import { initDevice, refreshDevice, refreshKeyboxStatus } from './device.js';
import { initClock } from './clock.js';
import { initNetwork } from './network.js';
import { initTheme } from './theme.js';
import { initI18n, getTranslation } from './i18n.js';
import { loadContributors } from './contributors.js';
import { initRedirect } from './redirect.js';
import { escapeHtml, shellEscape } from './utils.js';
import { openRecentActivity, addEntry } from './history.js';
import { showToast, closeToast } from './toast.js';
import { initTerminal, appendToOutput } from './terminal.js';
import { openFileBrowser } from './file-browser.js';
import { showErrorDialog } from './dialog.js';
import { setFriendlyNames, getFriendlyName } from './state.js';
import { API_URLS } from './constants.js';

let devMode = false;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initBridge();
    setModuleDir(getBridgeModuleDir());
    await migrateLocalStorage();
  } catch (e) {
    console.warn('Bridge init failed, running without module path:', e);
  }

  wireTopBarScroll();
  const savedTheme = await cfgGet('theme', 'dark') || 'dark';
  initTheme(savedTheme);
  wireNavigation();
  wireActions();
  wireKeyboxCard();
  wireRefreshButton();
  wireCustomKeybox();
  wireKeyboxInstallButton();
  await initI18n();
  Promise.all([initClock(), initNetwork(), populateProviders(), loadContributors()]).catch(err => console.warn('Init error:', err));
  await initDevice();
  initRedirect();
  buildFriendlyNames();

  const savedDevMode = await cfgGet('dev_mode', 'false') || 'false';
  devMode = savedDevMode === 'true';
  const sw = document.getElementById('dev-mode-switch');
  if (sw) sw.selected = devMode;
  wireDevMode();
  initTerminal();
});

function wireTopBarScroll() {
  const topBar = document.getElementById('top-bar');
  if (!topBar) return;
  window.addEventListener('scroll', () => {
    topBar.classList.toggle('app-top-bar--scrolled', window.scrollY > 0);
  });
}

function wireNavigation() {
  const navTabs = document.querySelectorAll('.nav-tab');
  const indicator = document.getElementById('nav-indicator');
  const pages = [
    document.getElementById('home-page'),
    document.getElementById('actions-page'),
    document.getElementById('advanced-page'),
    document.getElementById('settings-page'),
  ];

  function reposition(tab) {
    indicator.style.left = tab.offsetLeft + 'px';
    indicator.style.width = tab.offsetWidth + 'px';
  }

  requestAnimationFrame(() => {
    const active = document.querySelector('.nav-tab--active');
    if (active) reposition(active);
  });

  navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.classList.contains('nav-tab--active')) return;
      const oldTab = document.querySelector('.nav-tab--active');
      if (oldTab) {
        oldTab.classList.remove('nav-tab--active');
        oldTab.removeAttribute('aria-current');
        oldTab.querySelector('.nav-icon')?.classList.remove('nav-icon--filled');
      }
      tab.classList.add('nav-tab--active');
      tab.setAttribute('aria-current', 'page');
      tab.querySelector('.nav-icon')?.classList.add('nav-icon--filled');
      reposition(tab);
      const pageId = tab.dataset.page;
      pages.forEach((el) => { el.hidden = el.id !== pageId; });
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  });

  window.addEventListener('resize', () => {
    const active = document.querySelector('.nav-tab--active');
    if (active) reposition(active);
  });
}

function buildFriendlyNames() {
  const names = {};
  document.querySelectorAll('.list-item[data-script]').forEach(item => {
    const scriptName = item.dataset.script;
    const headline = item.querySelector('.toggle-text[data-i18n]');
    if (headline) names[scriptName] = headline.dataset.i18n;
  });
  setFriendlyNames(names);
}

function wireDevMode() {
  const sw = document.getElementById('dev-mode-switch');
  if (!sw) return;
  sw.addEventListener('change', () => {
    devMode = sw.selected;
    cfgSet('dev_mode', sw.selected ? 'true' : 'false');
  });
}

function wireActions() {
  document.querySelectorAll('.list-item[data-script]').forEach(item => {
    item.addEventListener('click', async (e) => {
      if (item.disabled) return;
      const scriptName = item.dataset.script;
      const spinner = item.querySelector('.action-spinner');
      item.disabled = true;
      spinner?.classList.remove('hidden');
      try {
        if (devMode) {
          await runDevAction(scriptName, item, spinner);
        } else {
          await runSimpleAction(scriptName, item, spinner);
        }
      } catch (_e) {
        console.warn('Action error:', _e);
      } finally {
        item.disabled = false;
        spinner?.classList.add('hidden');
      }
    });
  });
}

async function runDevAction(scriptName, item, spinner) {
  const lines = [];
  appendToOutput(`> ${scriptName}`);
  const dialog = document.createElement('md-dialog');
  dialog.innerHTML = `
    <div slot="headline">${scriptName}</div>
    <div slot="content"><div class="terminal"><pre id="live-output"></pre></div></div>
    <div slot="actions">
      <md-text-button class="dialog-close">${getTranslation('dialog_close') || 'Close'}</md-text-button>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => document.body.removeChild(dialog));
  dialog.show();
  const pre = dialog.querySelector('#live-output');
  const child = spawnScript(scriptName, 'feature');
  child.stdout.on('data', line => {
    appendToOutput(line); lines.push(line);
    if (pre) pre.textContent += line + '\n';
    if (pre?.parentElement) pre.parentElement.scrollTop = pre.parentElement.scrollHeight;
  });
  child.stderr.on('data', line => {
    appendToOutput(line, true); lines.push('[!] ' + line);
    if (pre) pre.textContent += '[!] ' + line + '\n';
    if (pre?.parentElement) pre.parentElement.scrollTop = pre.parentElement.scrollHeight;
  });
  child.on('exit', (code) => {
    appendToOutput(`> ${scriptName} exited (code: ${code})`);
    addEntry(scriptName, lines.join('\n'));
  });
  child.on('error', err => {
    const msg = err.message || 'Unknown error';
    appendToOutput(`> Error: ${msg}`, true);
    addEntry(scriptName, msg);
  });
}

async function runSimpleAction(scriptName, item, spinner) {
  const i18nKey = getFriendlyName(scriptName);
  const friendlyName = getTranslation(i18nKey) || i18nKey;
  const lines = [];
  appendToOutput(`> ${friendlyName}`);
  const dialog = document.getElementById('progress-dialog');
  const label = document.getElementById('progress-label');
  const text = document.getElementById('progress-text');
  if (label) label.textContent = friendlyName;
  if (text) text.textContent = getTranslation('simple_dialog_wait') || 'This may take a moment';
  dialog.show();
  const child = spawnScript(scriptName, 'feature');
  child.stdout.on('data', line => {
    appendToOutput(line); lines.push(line);
  });
  child.stderr.on('data', line => {
    appendToOutput(line, true); lines.push('[!] ' + line);
  });
  child.on('exit', (code) => {
    appendToOutput(`> ${friendlyName} exited (code: ${code})`);
    addEntry(scriptName, lines.join('\n'));
    dialog.close();
    if (code !== 0) {
      const errorMsg = lines.find(l => l.includes('Error')) || lines[lines.length - 1] || friendlyName;
      showToast(`${getTranslation('simple_toast_error') || 'Failed'}: ${errorMsg}`, {
        icon: 'error', type: 'error',
        action: getTranslation('simple_toast_view_details') || 'View Details',
        autoCloseDelay: 8000,
        onActionClick: () => {
          showErrorDialog(getTranslation('error_dialog_title') || 'Error Details', escapeHtml(lines.join('\n')));
        },
      });
    } else {
      showToast(getTranslation('toast_success') || 'Done', {
        icon: 'check_circle', type: 'success', autoCloseDelay: 3000,
      });
    }
  });
  child.on('error', err => {
    const msg = err.message || 'Unknown error';
    appendToOutput(`> Error: ${msg}`, true);
    addEntry(scriptName, msg);
    dialog.close();
    showToast(`${getTranslation('simple_toast_error') || 'Failed'}: ${friendlyName}`, {
      icon: 'error', type: 'error',
      action: getTranslation('simple_toast_view_details') || 'View Details',
      autoCloseDelay: 8000,
      onActionClick: () => {
        showErrorDialog(getTranslation('error_dialog_title') || 'Error Details', escapeHtml(msg));
      },
    });
  });
}

function wireRefreshButton() {
  const btn = document.getElementById('refresh-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    await Promise.all([refreshDevice(), refreshKeyboxStatus()]);
    btn.disabled = false;
  });
}

function wireKeyboxCard() {
  const card = document.getElementById('keybox-card');
  if (!card) return;
  card.addEventListener('click', () => {
    const sw = document.getElementById('dev-mode-switch');
    openRecentActivity(sw ? sw.selected : false);
  });
}

function renderProviderOptions(select, sources) {
  while (select.children.length > 1) select.removeChild(select.lastChild);
  for (const s of sources) {
    const opt = document.createElement('md-select-option');
    opt.setAttribute('value', s);
    opt.innerHTML = `<div slot="headline">${escapeHtml(s)}</div>`;
    select.appendChild(opt);
  }
}

async function populateProviders() {
  const select = document.getElementById('kb-provider');
  if (!select) return;

  const saved = await cfgGet('kb_provider', 'auto') || 'auto';

  if (!select._listenerAttached) {
    select.addEventListener('click', (e) => e.stopPropagation());
    select.addEventListener('change', (e) => { e.stopPropagation(); cfgSet('kb_provider', select.value); });
    select._listenerAttached = true;
  }

  try {
    const res = await fetch(API_URLS.KEY_CATALOG);
    if (res.ok) {
      const data = await res.json();
      const sources = [...new Set((data.entries || []).map(e => e.source))].sort();
      const currentValue = select.value;
      renderProviderOptions(select, sources);
      select.value = currentValue;
    }
  } catch (e) {
    console.warn('Provider fetch failed:', e);
  }
}

function wireCustomKeybox() {
  const btn = document.getElementById('custom-keybox-btn');
  if (!btn) return;
  btn.addEventListener('click', openCustomKeyboxDialog);
}

function wireKeyboxInstallButton() {
  const btn = document.getElementById('kb-install-btn');
  const card = document.querySelector('.keybox-install-card');
  const spinner = card?.querySelector('.kic-spinner');
  if (!btn) return;

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (btn.disabled) return;

    btn.disabled = true;
    spinner?.classList.remove('hidden');

    try {
      if (devMode) {
        await runDevAction('keybox.sh', btn, spinner);
      } else {
        await runSimpleAction('keybox.sh', btn, spinner);
      }
    } catch (_e) {
      console.warn('Install error:', _e);
    } finally {
      btn.disabled = false;
      spinner?.classList.add('hidden');
    }
  });
}

async function openCustomKeyboxDialog() {
  const t = (key, fallback) => getTranslation(key) || fallback;

  const dialog = document.createElement('md-dialog');

  dialog.innerHTML = `
    <div slot="headline" style="padding:20px 24px 4px">${t('custom_kb_title', 'Custom Keybox')}</div>
    <div slot="content" style="padding:4px 24px">
      <md-filled-card style="padding:12px;border-radius:14px;width:100%;box-sizing:border-box;--md-filled-card-container-color:var(--md-sys-color-surface-container-highest)">
        <div class="custom-kb-section">
          <div class="li-icon"><md-icon>upload_file</md-icon></div>
          <p style="margin:6px 0 2px;font-size:0.8125rem">${t('custom_kb_file', 'Import File')}</p>
          <p style="margin:0 0 8px;font-size:0.6875rem;color:var(--md-sys-color-on-surface-variant)">
            Select a keybox XML file from your device
          </p>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <md-assist-chip id="kb-file-chip" label="${t('custom_kb_no_file', 'No file selected')}" style="height:36px;font-size:0.75rem"></md-assist-chip>
            <input type="file" accept=".xml,.xml.bak" id="kb-hidden-file" style="display:none">
            <md-filled-tonal-button id="kb-file-btn" style="height:36px;font-size:0.75rem">${t('custom_kb_browse', 'Browse Files')}</md-filled-tonal-button>
          </div>
        </div>
      </md-filled-card>

      <md-filled-card style="padding:12px;border-radius:14px;width:100%;box-sizing:border-box;margin-top:8px;--md-filled-card-container-color:var(--md-sys-color-surface-container-highest)">
        <div class="custom-kb-section">
          <div class="li-icon"><md-icon>link</md-icon></div>
          <p style="margin:6px 0 2px;font-size:0.8125rem">${t('custom_kb_url', 'URL or Path')}</p>
          <p style="margin:0 0 8px;font-size:0.6875rem;color:var(--md-sys-color-on-surface-variant)">
            Paste a download URL or enter a device path
          </p>
          <md-outlined-text-field id="kb-url-input" style="width:100%;--md-outlined-text-field-container-shape:14px;--md-sys-shape-corner-extra-small:14px;border-radius:14px;height:44px" placeholder="https://example.com/keybox.xml or /sdcard/keybox.xml">
            <md-icon-button slot="trailing-icon" id="kb-paste-btn">
              <md-icon>content_paste</md-icon>
            </md-icon-button>
          </md-outlined-text-field>
        </div>
      </md-filled-card>
    </div>
    <div slot="actions" style="padding:4px 24px 20px">
      <md-text-button id="kb-clear"><md-icon slot="icon">delete</md-icon> ${t('custom_kb_clear', 'Clear')}</md-text-button>
      <div class="spacer"></div>
      <md-filled-tonal-button id="kb-apply">${t('custom_kb_apply', 'Apply')}</md-filled-tonal-button>
    </div>
  `;

  document.body.appendChild(dialog);

  const fileBtn = dialog.querySelector('#kb-file-btn');
  const urlInput = dialog.querySelector('#kb-url-input');
  const pasteBtn = dialog.querySelector('#kb-paste-btn');
  const clearBtn = dialog.querySelector('#kb-clear');
  const applyBtn = dialog.querySelector('#kb-apply');

  fileBtn.addEventListener('click', () => {
    openFileBrowser((filePath) => {
      urlInput.value = filePath;
      const chip = dialog.querySelector('#kb-file-chip');
      if (chip) chip.label = filePath.split('/').pop();
    });
  });

  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) urlInput.value = text;
    } catch (e) {
      console.warn('Clipboard read failed:', e);
    }
  });

  clearBtn.addEventListener('click', async () => {
    cfgSet('kb_custom_type', '');
    cfgSet('kb_custom_value', '');
    showToast(t('custom_kb_cleared', 'Custom keybox cleared'), { icon: 'info', type: 'info', autoCloseDelay: 2500 });
    dialog.close();
  });

  applyBtn.addEventListener('click', async () => {
    const { exec, getModuleDir } = await import('./bridge.js');
    const moddir = getModuleDir();
    const text = urlInput.value.trim();

    if (!text) {
      showToast('Enter a URL or device path', { icon: 'error', type: 'error', autoCloseDelay: 2500 });
      return;
    }

    // Show detecting toast
    const detectingToast = showToast(t('custom_kb_detecting', 'Detecting keybox...'), { icon: 'info', type: 'info', autoCloseDelay: 30000 });

    try {
      let serial = '';

      if (text.startsWith('http://') || text.startsWith('https://')) {
        // Download to temp, then decode
        const { stdout } = await exec(
          `curl -s ${shellEscape(text)} > /data/local/tmp/_kb_check.xml 2>/dev/null && ` +
          `. ${moddir}/lib/common.sh && decode_keybox_serial /data/local/tmp/_kb_check.xml`
        );
        serial = (stdout || '').trim();

        // Read the serial directly after decoding
        if (!serial) {
          // Try to decode the downloaded file differently
          const { stdout: s2 } = await exec(
            `. ${moddir}/lib/common.sh && _b64=$(sed -n '/-----BEGIN CERTIFICATE-----/,/-----END CERTIFICATE-----/p' /data/local/tmp/_kb_check.xml | head -20 | grep -v 'CERTIFICATE' | tr -d '\\n') && [ -n "$_b64" ] && _hex=$(echo "$_b64" | base64 -d 2>/dev/null | od -v -tx1 | awk 'BEGIN{ORS=""} {for(i=2;i<=NF;i++) printf "%s", $i}') && _parse_serial "$_hex" && echo "$_serial"`
          );
          serial = (s2 || '').trim();
        }
      } else if (text.startsWith('/')) {
        // Local file — decode directly
        const { stdout } = await exec(
          `. ${moddir}/lib/common.sh && decode_keybox_serial ${shellEscape(text)}`
        );
        serial = (stdout || '').trim();
        if (!serial) {
          const { stdout: s2 } = await exec(
            `. ${moddir}/lib/common.sh && _b64=$(sed -n '/-----BEGIN CERTIFICATE-----/,/-----END CERTIFICATE-----/p' ${shellEscape(text)} | head -20 | grep -v 'CERTIFICATE' | tr -d '\\n') && [ -n "$_b64" ] && _hex=$(echo "$_b64" | base64 -d 2>/dev/null | od -v -tx1 | awk 'BEGIN{ORS=""} {for(i=2;i<=NF;i++) printf "%s", $i}') && _parse_serial "$_hex" && echo "$_serial"`
          );
          serial = (s2 || '').trim();
        }
      }

      // Look up serial in catalog
      let catalogInfo = null;
      if (serial) {
        try {
          const catalogRes = await fetch(`${API_URLS.KEY_CATALOG_LOOKUP}?serial=${serial}`);
          if (catalogRes.ok) {
            catalogInfo = await catalogRes.json();
          }
        } catch (e) {
          console.warn('Catalog fetch failed:', e);
        }
      }

      // Show detected dialog
      const detectedDialog = document.createElement('md-dialog');
      detectedDialog.innerHTML = `
        <div slot="headline">${t('custom_kb_detected', 'Keybox Detected')}</div>
        <div slot="content" style="text-align:center;padding:8px 16px">
          ${catalogInfo ? `
            <div class="li-icon" style="margin:0 auto 8px"><md-icon>verified_user</md-icon></div>
            <p style="font-size:0.9375rem;font-weight:500;margin:4px 0">${t('custom_kb_known', 'Known Keybox')}</p>
            <div style="display:inline-flex;align-items:center;gap:8px;margin:4px 0">
              <md-chip style="--md-chip-label-text-color:var(--md-sys-color-primary)">${escapeHtml(catalogInfo.source)}</md-chip>
              <span style="font-size:0.8125rem;color:var(--md-sys-color-on-surface-variant)">${escapeHtml(catalogInfo.version)}</span>
            </div>
            <md-chip style="--md-chip-label-text-color:${catalogInfo.revoked ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-tertiary)'}">${catalogInfo.revoked ? t('custom_kb_revoked', 'Revoked') : t('custom_kb_active', 'Active')}</md-chip>
          ` : `
            <div class="li-icon" style="margin:0 auto 8px;background:var(--md-sys-color-surface-container-high)"><md-icon style="color:var(--md-sys-color-on-surface)">lock</md-icon></div>
            <p style="font-size:0.9375rem;font-weight:500;margin:4px 0">${t('custom_kb_private', 'Private Keybox')}</p>
            <p style="font-size:0.75rem;color:var(--md-sys-color-on-surface-variant);margin:4px 0">${t('custom_kb_private_desc', 'This keybox is not in the catalog')}</p>
          `}
        </div>
        <div slot="actions">
          <md-text-button id="kb-detect-cancel">${t('dialog_close', 'Cancel')}</md-text-button>
          <div class="spacer"></div>
          <md-filled-tonal-button id="kb-detect-apply">${t('custom_kb_apply_confirm', 'Apply')}</md-filled-tonal-button>
        </div>
      `;
      document.body.appendChild(detectedDialog);

      detectedDialog.querySelector('#kb-detect-cancel').addEventListener('click', () => detectedDialog.close());
      detectedDialog.querySelector('#kb-detect-apply').addEventListener('click', () => {
        if (text.startsWith('http://') || text.startsWith('https://')) {
          cfgSet('kb_custom_type', 'url');
        } else {
          cfgSet('kb_custom_type', 'path');
        }
        cfgSet('kb_custom_value', text);
        showToast(t('custom_kb_applied', 'Custom keybox configured'), { icon: 'check_circle', type: 'success', autoCloseDelay: 2500 });
        detectedDialog.close();
        dialog.close();
      });
      detectedDialog.addEventListener('close', () => document.body.removeChild(detectedDialog));
      closeToast(detectingToast);
      detectedDialog.show();

    } catch (e) {
      console.warn('Keybox detection failed:', e);
      closeToast(detectingToast);
      showToast('Failed to detect keybox', { icon: 'error', type: 'error', autoCloseDelay: 3000 });
    }
  });

  dialog.addEventListener('close', () => {
    document.body.removeChild(dialog);
  });
  dialog.show();
}


