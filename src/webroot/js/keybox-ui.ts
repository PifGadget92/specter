import { getModuleDir, exec, spawnScript } from './bridge.js';
import { cfgSet, cfgGet, cfgFlush } from './cfg.js';
import { getTranslation } from './i18n.js';
import { escapeHtml, shellEscape, fetchJson } from './utils.js';
import { showToast, closeToast } from './toast.js';
import { appendToOutput } from './terminal.js';
import { openFileBrowser } from './file-browser.js';
import { openRecentActivity } from './history.js';
import { API_URLS } from './constants.js';
import { runDevAction, runSimpleAction } from './actions.js';
import { isDevMode } from './state.js';
import type { CatalogJson } from './types.js';

const t = (key: string, fallback: string): string => getTranslation(key) || fallback;

export function wireKeyboxCard() {
  const card = document.getElementById('keybox-card');
  if (!card) return;
  card.addEventListener('click', () => {
    const sw = document.getElementById('dev-mode-switch') as MdSwitch | null;
    openRecentActivity(sw ? sw.selected : false);
  });
}

function renderProviderOptions(select: HTMLSelectElement, sources: string[]) {
  while (select.options.length > 1) select.remove(1);
  for (const s of sources) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  }
}

const providerSelects = new WeakSet<HTMLSelectElement>();

export async function populateProviders() {
  const select = document.getElementById('kb-provider') as HTMLSelectElement | null;
  if (!select) return;

  const saved = await cfgGet('kb_provider', 'auto') || 'auto';

  if (!providerSelects.has(select)) {
    providerSelects.add(select);
    select.addEventListener('change', () => { cfgSet('kb_provider', select.value); });
  }

  try {
    const data = await fetchJson<CatalogJson>(API_URLS.KEY_CATALOG, 300000);
    if (data?.entries) {
      const sources = [...new Set(data.entries.map(e => e.source))].sort();
      const currentValue = select.value;
      renderProviderOptions(select, sources);
      select.value = currentValue;
    }
  } catch (e) {
    console.warn('Provider fetch failed:', e);
  }
}

export function wireCustomKeybox() {
  const btn = document.getElementById('custom-keybox-btn');
  if (!btn) return;
  btn.addEventListener('click', openCustomKeyboxDialog);
}

export function wireKeyboxInstallButton() {
  const btn = document.getElementById('kb-install-btn') as MdFilledButton | null;
  const card = document.querySelector('.keybox-install-card');
  const spinner = card?.querySelector('.kic-spinner') as HTMLElement | null;
  if (!btn) return;

  btn.addEventListener('click', async (e: Event) => {
    e.stopPropagation();
    if (btn.disabled) return;

    btn.disabled = true;
    spinner?.classList.remove('hidden');

    try {
      cfgSet('kb_custom_type', '');
      cfgSet('kb_custom_value', '');
      await cfgFlush();
      if (isDevMode()) {
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

export async function openCustomKeyboxDialog() {

  const dialog = document.createElement('md-dialog');

  dialog.innerHTML = `
    <div slot="headline" style="padding:20px 24px 4px">${t('custom_kb_title', 'Custom Keybox')}</div>
    <div slot="content" style="padding:4px 24px">
      <md-filled-card style="padding:12px;border-radius:14px;width:100%;box-sizing:border-box;--md-filled-card-container-color:var(--md-sys-color-surface-container-highest)">
        <div class="custom-kb-section">
          <div class="li-icon"><md-icon>upload_file</md-icon></div>
          <p style="margin:6px 0 2px;font-size:0.8125rem">${t('custom_kb_file', 'Import File')}</p>
            <p style="margin:0 0 8px;font-size:0.6875rem;color:var(--md-sys-color-on-surface-variant)">
              ${t('custom_kb_file_desc', 'Select a keybox XML file from your device')}
            </p>
          <div style="display:flex;align-items:center;gap:8px;width:100%">
            <md-assist-chip id="kb-file-chip" label="${t('custom_kb_no_file', 'No file selected')}" style="min-width:0;overflow:hidden;text-overflow:ellipsis;flex:1;height:36px;font-size:0.75rem"></md-assist-chip>
            <span class="kb-browse-wrap">
              <md-filled-tonal-button class="kb-browse-textonly" aria-label="${t('custom_kb_browse', 'Browse Files')}">${t('custom_kb_browse', 'Browse')}</md-filled-tonal-button>
              <button class="kb-browse-icononly" aria-label="${t('custom_kb_browse', 'Browse Files')}"><md-icon>folder_open</md-icon></button>
            </span>
          </div>
        </div>
      </md-filled-card>

      <md-filled-card style="padding:12px;border-radius:14px;width:100%;box-sizing:border-box;margin-top:8px;--md-filled-card-container-color:var(--md-sys-color-surface-container-highest)">
        <div class="custom-kb-section">
          <div class="li-icon"><md-icon>link</md-icon></div>
          <p style="margin:6px 0 2px;font-size:0.8125rem">${t('custom_kb_url', 'URL or Path')}</p>
          <p style="margin:0 0 8px;font-size:0.6875rem;color:var(--md-sys-color-on-surface-variant)">
            ${t('custom_kb_desc', 'Paste a download URL or enter a device path')}
          </p>
          <md-outlined-text-field id="kb-url-input" style="width:100%;--md-outlined-text-field-container-shape:14px;--md-sys-shape-corner-extra-small:14px;border-radius:14px;height:44px" placeholder="${t('kb_url_placeholder', 'https://example.com/keybox.xml or /sdcard/keybox.xml')}">
            <md-icon-button slot="trailing-icon" id="kb-paste-btn" aria-label="${t('kb_paste_aria', 'Paste from clipboard')}">
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

  const fileWrap = dialog.querySelector('.kb-browse-wrap');
  const urlInput = dialog.querySelector('#kb-url-input') as MdOutlinedTextField;
  const pasteBtn = dialog.querySelector('#kb-paste-btn');
  const clearBtn = dialog.querySelector('#kb-clear');
  const applyBtn = dialog.querySelector('#kb-apply');

  fileWrap!.addEventListener('click', () => {
    openFileBrowser((filePath: string) => {
      urlInput.value = filePath;
      const chip = dialog.querySelector('#kb-file-chip') as MdAssistChip | null;
      if (chip) chip.label = filePath.split('/').pop() || filePath;
    });
  });

  pasteBtn!.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) urlInput.value = text;
    } catch (e) {
      console.warn('Clipboard read failed:', e);
    }
  });

  clearBtn!.addEventListener('click', async () => {
    cfgSet('kb_custom_type', '');
    cfgSet('kb_custom_value', '');
    cfgSet('kb_private', '');
    showToast(t('custom_kb_cleared', 'Custom keybox cleared'), { icon: 'info', type: 'info' as any, autoCloseDelay: 2500 });
    dialog.close();
  });

  applyBtn!.addEventListener('click', async () => {
    const moddir = getModuleDir();
    const text = urlInput.value.trim();

    if (!text) {
      showToast(t('toast_enter_url', 'Enter a URL or device path'), { icon: 'error', type: 'error' as any, autoCloseDelay: 2500 });
      return;
    }

    const privateChoice = await new Promise<boolean>(resolve => {
      const pd = document.createElement('md-dialog');
      pd.className = 'private-dialog';
      pd.innerHTML = `
        <div slot="headline">${t('custom_kb_title', 'Custom Keybox')}</div>
        <div slot="content">
          <p class="private-dialog-msg">${t('custom_kb_private_ask', 'Is this a private keybox?')}</p>
        </div>
        <div slot="actions">
          <md-text-button id="kb-pri-no" value="no">${t('custom_kb_no', 'No')}</md-text-button>
          <md-text-button id="kb-pri-yes" value="yes">${t('custom_kb_yes', 'Yes')}</md-text-button>
        </div>
      `;
      document.body.appendChild(pd);
      pd.querySelector('#kb-pri-no')!.addEventListener('click', () => { pd.close(); resolve(false); });
      pd.querySelector('#kb-pri-yes')!.addEventListener('click', () => { pd.close(); resolve(true); });
      pd.addEventListener('close', () => document.body.removeChild(pd));
      pd.show();
    });

    if (privateChoice) {
      if (text.startsWith('http://') || text.startsWith('https://')) {
        cfgSet('kb_custom_type', 'url');
      } else {
        cfgSet('kb_custom_type', 'path');
      }
      cfgSet('kb_custom_value', text);
      cfgSet('kb_private', 'true');
      await cfgFlush();
      const result: any = await exec(`sh ${shellEscape(moddir + '/features/keybox.sh')}`);
      if (result.code === 0) {
        showToast(t('custom_kb_installed', 'Custom keybox installed'), { icon: 'check_circle', type: 'success' as any, autoCloseDelay: 3000 });
      } else {
        showToast(t('custom_kb_install_failed', 'Install failed'), { icon: 'error', type: 'error' as any, autoCloseDelay: 5000 });
      }
      dialog.close();
      return;
    }

    const detectingToast = showToast(t('custom_kb_detecting', 'Detecting keybox...'), { icon: 'info', type: 'info' as any, autoCloseDelay: 30000 });

    try {
      let serial = '';

      if (text.startsWith('http://') || text.startsWith('https://')) {
        const result: any = await exec(
          `wget -qO /data/local/tmp/_kb_check.xml ${shellEscape(text)} 2>/dev/null || ` +
          `curl -s ${shellEscape(text)} > /data/local/tmp/_kb_check.xml 2>/dev/null && ` +
          `. ${moddir}/lib/common.sh && decode_keybox_serial /data/local/tmp/_kb_check.xml`
        );
        serial = (result.stdout || '').trim();
      } else if (text.startsWith('/')) {
        const result: any = await exec(
          `. ${moddir}/lib/common.sh && decode_keybox_serial ${shellEscape(text)}`
        );
        serial = (result.stdout || '').trim();
      }

      let catalogInfo: any = null;
      if (serial) {
        try {
          const catalogData = await fetchJson<CatalogJson>(API_URLS.KEY_CATALOG);
          if (catalogData?.entries) {
            catalogInfo = catalogData.entries.find(e => e.serial === serial) || null;
          }
        } catch (e) {
          console.warn('Catalog fetch failed:', e);
        }
      }

      const detectedDialog = document.createElement('md-dialog');
      detectedDialog.className = 'detected-dialog';
      detectedDialog.setAttribute('type', 'alert');
      detectedDialog.innerHTML = `
        <div slot="headline">${t('custom_kb_detected', 'Keybox Detected')}</div>
        <div slot="content" class="detected-dialog-content">
          ${catalogInfo ? `
            <span class="detected-dialog-icon"><md-icon>verified_user</md-icon></span>
            <p class="detected-dialog-status">${t('custom_kb_known', 'Known Keybox')}</p>
            <div class="detected-dialog-chip-row">
              <md-chip style="--md-chip-label-text-color:var(--md-sys-color-primary)">${escapeHtml(catalogInfo.source)}</md-chip>
              <span style="font-size:0.8125rem;color:var(--md-sys-color-on-surface-variant)">${escapeHtml(catalogInfo.version)}</span>
            </div>
            <md-chip style="--md-chip-label-text-color:${catalogInfo.revoked ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-tertiary)'}">${catalogInfo.revoked ? t('custom_kb_revoked', 'Revoked') : t('custom_kb_active', 'Active')}</md-chip>
          ` : `
            <span class="detected-dialog-icon"><md-icon>search_off</md-icon></span>
            <p class="detected-dialog-status">${t('custom_kb_not_found', 'Not Found in Catalog')}</p>
            <p class="detected-dialog-desc">${t('custom_kb_not_found_desc', 'This keybox could not be matched to any known source')}</p>
          `}
        </div>
        <div slot="actions">
          <md-text-button id="kb-detect-cancel">${t('dialog_cancel', 'Cancel')}</md-text-button>
          <div class="spacer"></div>
          <md-filled-button id="kb-detect-apply" class="detected-dialog-apply">${t('custom_kb_apply_confirm', 'Apply')}</md-filled-button>
        </div>
      `;
      document.body.appendChild(detectedDialog);

      detectedDialog.querySelector('#kb-detect-cancel')!.addEventListener('click', () => detectedDialog.close());
      detectedDialog.querySelector('#kb-detect-apply')!.addEventListener('click', async () => {
        if (text.startsWith('http://') || text.startsWith('https://')) {
          cfgSet('kb_custom_type', 'url');
        } else {
          cfgSet('kb_custom_type', 'path');
        }
        cfgSet('kb_custom_value', text);
        cfgSet('kb_private', '');
        await cfgFlush();
        const result: any = await exec(`sh ${shellEscape(moddir + '/features/keybox.sh')}`);
        if (result.code === 0) {
          showToast(t('custom_kb_installed', 'Custom keybox installed'), { icon: 'check_circle', type: 'success' as any, autoCloseDelay: 3000 });
        } else {
          showToast(t('custom_kb_install_failed', 'Install failed'), { icon: 'error', type: 'error' as any, autoCloseDelay: 5000 });
        }
        detectedDialog.close();
        dialog.close();
      });
      detectedDialog.addEventListener('close', () => document.body.removeChild(detectedDialog));
      closeToast(detectingToast!);
      detectedDialog.show();

    } catch (e) {
      console.warn('Keybox detection failed:', e);
      closeToast(detectingToast!);
      showToast(t('toast_detect_failed', 'Failed to detect keybox'), { icon: 'error', type: 'error' as any, autoCloseDelay: 3000 });
    }
  });

  dialog.addEventListener('close', () => {
    document.body.removeChild(dialog);
  });
  dialog.show();
}
