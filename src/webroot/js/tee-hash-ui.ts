import { exec, spawnScript } from './bridge.js';
import { getTranslation } from './i18n.js';
import { showToast } from './toast.js';
import { addEntry } from './history.js';
import { appendToOutput } from './terminal.js';
import { shellEscape } from './utils.js';

const t = (key: string, fallback: string): string => getTranslation(key) || fallback;

function getSpDir(): string {
  return '/data/adb/specter';
}

export function wireTeeHash() {
  const btn = document.getElementById('tee-hash-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const progress = document.getElementById('progress-dialog') as MdDialog | null;
    const label = document.getElementById('progress-label');
    if (label) label.textContent = t('check_tee_hash', 'TEE & Boot Hash');
    progress?.show();

    const lines: string[] = [];
    let stdout = '';

    try {
      const child = spawnScript('check_tee_hash.sh', 'common');

      child.stdout.on('data', (line: string) => {
        stdout += line + '\n';
        lines.push(line);
        appendToOutput(line);
      });
      child.stderr.on('data', (line: string) => {
        lines.push('[!] ' + line);
        appendToOutput(line, true);
      });

      const exitCode = await new Promise<number>(resolve => {
        child.on('exit', resolve);
        child.on('error', () => resolve(-1));
      });

      progress?.close();

      if (exitCode !== 0 && !lines.length) {
        showToast(t('simple_toast_error', 'Failed'), {
          icon: 'error', type: 'error', autoCloseDelay: 3000,
        });
        return;
      }

      const params: Record<string, string> = {};
      for (const kv of lines) {
        const m = kv.match(/^(\w+)=(.+)$/);
        if (m) params[m[1]!] = m[2]!.trim();
      }

      const teeStatus = params['tee_status'] || 'unknown';
      const teeHash = params['tee_hash'] || '';
      const vbmetaHash = params['vbmeta_hash'] || '';
      const bootHash = params['boot_hash'] || '';
      const teeTier = params['tee_tier'] || '';

      showResultDialog(teeStatus, teeHash, bootHash, vbmetaHash, teeTier);

      addEntry('check_tee_hash.sh', stdout);
    } catch {
      progress?.close();
      showToast(t('simple_toast_error', 'Failed'), {
        icon: 'error', type: 'error', autoCloseDelay: 3000,
      });
    }
  });
}

function showResultDialog(
  teeStatus: string,
  teeHash: string,
  bootHash: string,
  vbmetaHash: string,
  teeTier: string,
) {
  const statusIcon = teeStatus === 'normal' ? 'check_circle' : teeStatus === 'broken' ? 'error' : 'help';
  const statusClass = `tee-status--${teeStatus === 'normal' ? 'normal' : teeStatus === 'broken' ? 'broken' : 'unknown'}`;
  const statusLabel = teeStatus === 'normal' ? t('tee_status_normal', 'Normal')
    : teeStatus === 'broken' ? t('tee_status_broken', 'Broken')
    : teeStatus === 'error' ? t('tee_status_error', 'Error')
    : t('tee_status_unknown', 'Unknown');

  const tierIcon = teeTier === '2' ? 'verified' : teeTier === '1' ? 'security' : 'shield';
  const tierLabel = teeTier === '2' ? t('tee_tier_strongbox', 'StrongBox')
    : teeTier === '1' ? t('tee_tier_tee', 'TEE')
    : teeTier === '0' ? t('tee_tier_software', 'Software')
    : t('tee_tier_unknown', 'Unknown');

  const mismatch = vbmetaHash && teeHash && vbmetaHash !== teeHash;
  const teeClass = mismatch ? 'boot-hash-text boot-hash-text--mismatch' : 'boot-hash-text';
  const vbmetaClass = mismatch ? 'boot-hash-text boot-hash-text--mismatch' : 'boot-hash-text';

  function hashRow(label: string, hash: string, id: string, extraClass: string): string {
    if (!hash) return '';
    return `
    <div class="tee-hash-row">
      <span class="tee-hash-label">${label}</span>
      <span class="tee-hash-value">
        <code class="${extraClass}">${hash}</code>
        <md-icon-button id="${id}" aria-label="${t('history_copy', 'Copy')}">
          <md-icon aria-hidden="true">content_copy</md-icon>
        </md-icon-button>
      </span>
    </div>`;
  }

  const content = `
    <div class="tee-hash-row">
      <span class="tee-hash-label">${t('tee_status_label', 'TEE Status')}</span>
      <span class="tee-hash-value">
        <span class="tee-status-badge ${statusClass}">
          <md-icon aria-hidden="true">${statusIcon}</md-icon>
          ${statusLabel}
        </span>
      </span>
    </div>
    <div class="tee-hash-row">
      <span class="tee-hash-label">${t('tee_tier_label', 'Security Tier')}</span>
      <span class="tee-hash-value">
        <span class="tee-tier-badge">
          <md-icon aria-hidden="true">${tierIcon}</md-icon>
          ${tierLabel}
        </span>
      </span>
    </div>
    <md-divider class="settings-divider"></md-divider>
    ${hashRow(t('boot_hash_tee', 'Boot Hash (TEE)'), teeHash, 'tee-hash-copy-tee', teeClass)}
    ${hashRow(t('boot_hash_prop', 'Boot Hash (Prop)'), bootHash, 'tee-hash-copy-prop', 'boot-hash-text')}
    ${hashRow(t('boot_hash_calc', 'Boot Hash (Calc)'), vbmetaHash, 'tee-hash-copy-calc', vbmetaClass)}
  `;

  const actions = `
    <md-text-button id="tee-hash-close">${t('dialog_close', 'Close')}</md-text-button>
    <md-filled-tonal-button id="tee-hash-save">${t('cache_update', 'Update cache')}</md-filled-tonal-button>
  `;

  const dialog = document.createElement('md-dialog');
  dialog.innerHTML = `
    <div slot="headline">${t('check_tee_hash', 'TEE & Boot Hash')}</div>
    <div slot="content">${content}</div>
    <div slot="actions">${actions}</div>
  `;
  document.body.appendChild(dialog);

  dialog.querySelector('#tee-hash-close')!.addEventListener('click', () => dialog.close());

  const copyMap: Record<string, string> = {
    'tee-hash-copy-tee': teeHash,
    'tee-hash-copy-prop': bootHash,
    'tee-hash-copy-calc': vbmetaHash,
  };
  for (const [id, hash] of Object.entries(copyMap)) {
    dialog.querySelector(`#${id}`)?.addEventListener('click', () => {
      if (!hash) return;
      navigator.clipboard.writeText(hash).then(() => {
        showToast(t('history_copied', 'Copied!'), { icon: 'check_circle', type: 'success', autoCloseDelay: 2000 });
      }).catch(() => {
        showToast(t('history_copy_failed', 'Failed'), { icon: 'error', type: 'error', autoCloseDelay: 2000 });
      });
    });
  }

  dialog.querySelector('#tee-hash-save')!.addEventListener('click', async () => {
    try {
      const spDir = getSpDir();
      const cmds: string[] = [];

      const teeBool = teeStatus === 'normal' ? 'false' : 'true';
      cmds.push(`mkdir -p ${shellEscape(spDir)}`);
      cmds.push(`printf 'tee_broken=%s\\n' ${shellEscape(teeBool)} > ${shellEscape(spDir + '/tee_status')}`);

      if (teeHash) {
        cmds.push(`printf '%s\\n' ${shellEscape(teeHash)} > ${shellEscape(spDir + '/tee_hash')}`);
      }
      if (teeTier) {
        cmds.push(`printf '%s\\n' ${shellEscape(teeTier)} > ${shellEscape(spDir + '/tee_tier')}`);
      }
      if (vbmetaHash) {
        cmds.push(`printf '%s\\n' ${shellEscape(vbmetaHash)} > ${shellEscape(spDir + '/vbmeta_digest')}`);
      }
      cmds.push(`rm -f ${shellEscape(spDir + '/tee_reported')}`);

      await exec(cmds.join(' && '));
      showToast(t('cache_updated', 'Cache updated'), {
        icon: 'check_circle', type: 'success', autoCloseDelay: 2500,
      });
      dialog.close();
    } catch {
      showToast(t('boot_hash_save_error', 'Failed to save'), {
        icon: 'error', type: 'error', autoCloseDelay: 4000,
      });
    }
  });

  dialog.addEventListener('close', () => document.body.removeChild(dialog));
  dialog.show();
}
