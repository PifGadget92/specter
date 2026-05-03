import { shellEscape } from './utils.js';
import { getTranslation } from './i18n.js';

export async function openFileBrowser(onSelect) {
  const t = (key, fallback) => getTranslation(key) || fallback;
  let currentPath = '/sdcard';
  let entries = [];
  let selectedFile = null;
  let allFiles = false;

  const dialog = document.createElement('md-dialog');
  dialog.style.width = '400px';

  function rowHTML(path, icon, name, isFolder, isSelected) {
    const bg = isSelected ? ';background:var(--md-sys-color-primary-container)' : '';
    return `<div class="fb-row" data-path="${path}" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;cursor:pointer;transition:background 0.15s${bg}" onmouseenter="this.style.background='var(--md-sys-color-surface-container-high)'" onmouseleave="this.style.background='${isSelected ? 'var(--md-sys-color-primary-container)' : 'transparent'}'">
      <span style="width:32px;height:32px;border-radius:8px;background:${isFolder ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-secondary-container)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <md-icon style="font-size:16px;color:${isFolder ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-secondary-container)'};font-family:'Material Icons'">${icon}</md-icon>
      </span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.875rem">${name}</span>
      ${isFolder ? '<md-icon style="font-size:18px;color:var(--md-sys-color-on-surface-variant);font-family:\'Material Icons\'">chevron_right</md-icon>' : ''}
    </div>`;
  }

  function render() {
    const dirs = entries.filter(e => e.isFolder);
    const files = entries.filter(e => !e.isFolder && (allFiles || e.name.endsWith('.xml') || e.name.endsWith('.bak')));
    dialog.innerHTML = `
      <div slot="headline" style="padding:16px 20px 0;font-size:0.9375rem;font-weight:500;display:flex;align-items:center;gap:8px">
        ${currentPath !== '/sdcard' ? '<md-icon-button id="fb-back" style="width:32px;height:32px;--md-icon-button-icon-size:20px"><md-icon>arrow_back</md-icon></md-icon-button>' : ''}
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.8125rem;color:var(--md-sys-color-on-surface-variant)">${currentPath}</span>
      </div>
      <div slot="content" style="padding:4px 16px 8px;max-height:380px;overflow-y:auto">
        ${currentPath !== '/' && currentPath !== '/sdcard' ? rowHTML('..', 'folder_open', '..', true, false) : ''}
        ${dirs.map(d => rowHTML(d.path, 'folder', d.name, true, false)).join('')}
        ${files.length === 0 && dirs.length === 0 ? '<div style="text-align:center;padding:32px 16px;color:var(--md-sys-color-on-surface-variant);font-size:0.8125rem">No XML files found</div>' : ''}
        ${files.map(f => rowHTML(f.path, 'description', f.name, false, selectedFile === f.path)).join('')}
        ${!allFiles && files.length < entries.length ? '<div style="text-align:center;padding:8px;font-size:0.75rem;color:var(--md-sys-color-on-surface-variant)"><span id="fb-show-all" style="cursor:pointer;color:var(--md-sys-color-primary);text-decoration:underline">Show all files</span></div>' : ''}
      </div>
      <div slot="actions" style="padding:0 20px 16px">
        <md-text-button id="fb-cancel">${t('dialog_close', 'Close')}</md-text-button>
        <div class="spacer"></div>
        <md-filled-tonal-button id="fb-select" ${selectedFile ? '' : 'disabled'}>${t('custom_kb_apply', 'Select')}</md-filled-tonal-button>
      </div>
    `;

    dialog.querySelector('#fb-back')?.addEventListener('click', () => {
      currentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
      loadDir(currentPath);
    });
    dialog.querySelector('#fb-show-all')?.addEventListener('click', () => { allFiles = true; render(); });

    dialog.querySelectorAll('.fb-row').forEach(el => {
      el.addEventListener('click', async () => {
        const path = el.dataset.path;
        if (path === '..') {
          currentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
          await loadDir(currentPath);
          return;
        }
        const entry = entries.find(e => e.path === path);
        if (entry?.isFolder) {
          currentPath = path;
          await loadDir(path);
        } else {
          selectedFile = path;
          render();
        }
      });
    });

    dialog.querySelector('#fb-cancel')?.addEventListener('click', () => dialog.close());
    dialog.querySelector('#fb-select')?.addEventListener('click', () => {
      if (selectedFile) { onSelect(selectedFile); dialog.close(); }
    });

    if (!document.body.contains(dialog)) {
      document.body.appendChild(dialog);
      dialog.addEventListener('close', () => document.body.removeChild(dialog));
      dialog.show();
    }
  }

  async function loadDir(path) {
    dialog.innerHTML = `
      <div slot="headline" style="padding:16px 20px 0;font-size:0.9375rem;font-weight:500">
        <span style="font-size:0.8125rem;color:var(--md-sys-color-on-surface-variant)">${path}</span>
      </div>
      <div slot="content" style="display:flex;align-items:center;justify-content:center;padding:48px 20px">
        <md-circular-progress indeterminate></md-circular-progress>
      </div>
    `;
    if (!document.body.contains(dialog)) {
      document.body.appendChild(dialog);
      dialog.addEventListener('close', () => document.body.removeChild(dialog));
      dialog.show();
    }
    const { exec } = await import('./bridge.js');
    try {
      const { stdout } = await exec(`ls -1p ${shellEscape(path)} 2>/dev/null | head -200`);
      entries = (stdout || '').split('\n').filter(Boolean).map(line => ({
        name: line.replace(/\/$/, ''),
        isFolder: line.endsWith('/') && line !== '../',
        path: path + '/' + line.replace(/\/$/, '')
      })).filter(e => e.name !== '.' && e.name !== '..');
      selectedFile = null;
      allFiles = false;
      render();
    } catch (e) {
      console.warn('Directory listing failed:', e);
      entries = [];
      render();
    }
  }

  await loadDir(currentPath);
}
