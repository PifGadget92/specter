import { escapeHtml } from './utils.js';
import { getFriendlyNames } from './state.js';
import { STORAGE_KEY, MAX_ENTRIES } from './constants.js';
import { getTranslation } from './i18n.js';
import { showToast } from './toast.js';
import '@material/web/iconbutton/icon-button.js';

const t = (key: string, fallback: string): string => getTranslation(key) || fallback;

function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  return fallbackCopy(text);
}

function fallbackCopy(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

interface HistoryEntry {
  script: string;
  output: string;
  time: string;
}

export function getHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (e) { console.warn('Failed to parse history:', e); return []; }
}

export function addEntry(scriptName: string, output: string) {
  if (typeof output !== 'string') output = String(output || '');
  if (!output.trim()) return;
  const entries = getHistory();
  entries.unshift({ script: scriptName, output, time: new Date().toISOString() });
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch (e) { console.warn('Failed to save history:', e); }
}

function clearHistory() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { console.warn('Failed to clear history:', e); }
}

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const oneDay = 86400000;
    const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    if (diff < oneDay && date.getDate() === now.getDate()) {
      return (getTranslation('time_today') || 'Today at ') + timeStr;
    }
    if (diff < 2 * oneDay && date.getDate() === new Date(now.getTime() - oneDay).getDate()) {
      return (getTranslation('time_yesterday') || 'Yesterday at ') + timeStr;
    }
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + (getTranslation('time_at') || ' at ') + timeStr;
    }
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) { console.warn('Failed to parse date:', e);
    return isoString;
  }
}

function isErrorOutput(output: string): boolean {
  return output.includes('[!]') || output.toLowerCase().includes('error');
}

export async function openRecentActivity(devMode = false) {
  const entries = getHistory();
  if (!entries || entries.length === 0) {
    const dialog = document.createElement('md-dialog');
    dialog.innerHTML = `
      <div slot="headline">${getTranslation('history_title') || 'Recent Activity'}</div>
      <div slot="content">
        <div class="activity-empty">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="var(--md-sys-color-outline)"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.95 8.95 0 0 0 13 21a9 9 0 0 0 0-18m-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
          <p class="md-typescale-title-medium">${getTranslation('history_empty') || 'No activity yet - run an action to get started'}</p>
        </div>
      </div>
      <div slot="actions">
        <md-text-button class="dialog-action-close">${getTranslation('dialog_close') || 'Close'}</md-text-button>
      </div>
    `;
    document.body.appendChild(dialog);
    dialog.querySelector('.dialog-action-close')!.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => document.body.removeChild(dialog));
    dialog.show();
    return;
  }

  const list = document.createElement('div');
  list.className = 'activity-list';

  entries.forEach((entry) => {
    const i18nKey = getFriendlyNames()[entry.script];
    const friendlyName = (i18nKey && getTranslation(i18nKey)) || entry.script;
    const isError = isErrorOutput(entry.output);
    const statusIcon = isError ? 'error' : 'check_circle';

    const card = document.createElement('md-elevated-card');
    card.className = 'activity-card' + (isError ? ' activity-card--error' : ' activity-card--success');

    card.innerHTML = `
      <div class="activity-card__header">
        <div class="activity-card__leading">
          <md-icon class="activity-card__icon">${statusIcon}</md-icon>
        </div>
        <div class="activity-card__content">
          <span class="activity-card__name">${escapeHtml(friendlyName)}</span>
          <span class="activity-card__time">${formatTime(entry.time)}</span>
        </div>
        <div class="activity-card__actions" style="display:flex;align-items:center;gap:4px">
          <md-icon-button class="activity-card__header-copy-btn" aria-label="${getTranslation('history_copy') || 'Copy'}">
            <md-icon>content_copy</md-icon>
          </md-icon-button>
          ${devMode ? `<md-icon class="activity-card__chevron">expand_more</md-icon>` : ''}
        </div>
      </div>
      ${devMode ? `<div class="activity-card__body">
        <pre>${escapeHtml(entry.output)}</pre>
      </div>` : ''}
    `;

    const header = card.querySelector('.activity-card__header');
    const copyBtn = card.querySelector('.activity-card__header-copy-btn');

    copyBtn!.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(entry.output).then(() => {
        showToast(getTranslation('history_copied') || 'Copied!', { icon: 'check_circle', type: 'success', autoCloseDelay: 2000 });
      }).catch(() => {
        showToast(getTranslation('history_copy_failed') || 'Failed to copy', { icon: 'error', type: 'error', autoCloseDelay: 2000 });
      });
    });

    if (devMode) {
      const body = card.querySelector('.activity-card__body');
      const chevron = card.querySelector('.activity-card__chevron');

      function toggle() {
        const isOpen = body!.classList.toggle('open');
        chevron!.classList.toggle('expanded', isOpen);
      }

      header!.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.activity-card__header-copy-btn')) return;
        toggle();
      });
    }

    list.appendChild(card);
  });

  const dialog = document.createElement('md-dialog');
  dialog.innerHTML = `
    <div slot="headline">${getTranslation('history_title') || 'Recent Activity'}</div>
    <div slot="content"></div>
    <div slot="actions">
      <md-text-button class="dialog-action-clear">${getTranslation('dialog_clear') || 'Clear'}</md-text-button>
      <md-text-button class="dialog-action-close">${getTranslation('dialog_close') || 'Close'}</md-text-button>
    </div>
  `;
  dialog.querySelector('[slot="content"]')!.appendChild(list);
  document.body.appendChild(dialog);

  dialog.querySelector('.dialog-action-clear')!.addEventListener('click', async () => {
    clearHistory();
    dialog.close();
    setTimeout(() => openRecentActivity(), 100);
  });
  dialog.querySelector('.dialog-action-close')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => document.body.removeChild(dialog));
  dialog.show();
}

export function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return t('home_just_now', 'Just now');
    if (diffMins < 60) return `${diffMins}${t('home_min_ago', 'm ago')}`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}${t('home_hour_ago', 'h ago')}`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}${t('home_day_ago', 'd ago')}`;
  } catch (e) { return ''; }
}

export function renderActivityPreview() {
  const container = document.getElementById('activity-list');
  const countEl = document.getElementById('activity-count');
  if (!container) return;

  const clearBtn = document.getElementById('clear-history-btn');
  if (clearBtn) {
    clearBtn.onclick = () => {
      clearHistory();
      renderActivityPreview();
    };
  }

  const VISIBLE_COUNT = 4;
  const allEntries = getHistory();
  const count = allEntries.length;
  if (countEl) countEl.textContent = `${count} ${t('home_events', 'events')}`;

  if (count === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '';

  function extractValue(output: string, pattern: RegExp): string | null {
    const m = output.match(pattern);
    return m ? (m[1] ?? null) : null;
  }

  function extractError(output: string): string | null {
    const m = output.match(/^\[?!\]?\s*(?:Error|Warning):\s*(.+)$/im);
    return m ? (m[1]?.trim() ?? null) : null;
  }

  const DESCRIPTION_EXTRACTORS: Record<string, (o: string, c: number) => string | null> = {
    'keybox.sh': (o, c) => {
      if (c !== 0) return extractError(o) || 'Keybox install failed';
      const src = extractValue(o, /(?:Auto-selected|Selected provider|Fallback selected)[:\s]+(.+)$/im);
      if (src) return `Keybox: ${src}`;
      if (o.includes('Custom keybox installed from')) return 'Keybox: custom file';
      if (o.includes('Custom keybox installed from URL')) return 'Keybox: custom URL';
      return 'Keybox installed';
    },
    'gms.sh': (o) => {
      const count = extractValue(o, /Force-stopped (\d+) packages/i);
      const cleared = o.includes('Play Store data cleared');
      if (count && cleared) return `Stop ${count} + Play Store cleared`;
      if (count) return `Stop ${count} packages`;
      if (cleared) return 'Play Store cleared';
      return 'GMS action done';
    },
    'target.sh': (o, c) => {
      if (c !== 0) return extractError(o) || 'Target update failed';
      if (o.includes('Denylist merge')) {
        const a = extractValue(o, /added (\d+)/);
        return a ? `Denylist +${a}` : 'Denylist merged';
      }
      if (o.includes('Mode: merge')) {
        const a = extractValue(o, /added (\d+)/);
        return a ? `Merge +${a}` : 'Targets merged';
      }
      const w = extractValue(o, /Wrote (\d+) entries/);
      return w ? `Wrote ${w} targets` : 'Target updated';
    },
    'pif.sh': (o, c) => {
      if (c !== 0) return extractError(o) || 'PIF update failed';
      const model = extractValue(o, /MODEL=(\S+)/);
      if (model) return `PIF: ${model}`;
      const name = extractValue(o, /Detected:\s*(.+)$/im);
      return name ? `PIF updated (${name})` : 'PIF updated';
    },
    'rom_spoof_cleanup.sh': (o) => {
      if (o.includes('No spoof engines found')) return 'No spoof engines';
      if (o.includes('Spoof engines detected')) return 'Spoof engines cleaned';
      return 'Spoof check done';
    },
    'hma.sh': (o) => {
      if (o.includes('No HMA variant installed')) return 'No HMA found';
      if (o.includes('Config installed')) {
        const v = extractValue(o, /Config installed for (.+)$/im);
        return v ? `HMA config: ${v}` : 'HMA config installed';
      }
      if (o.includes('Download returned empty') || o.includes('download failed')) return 'HMA download failed';
      return 'HMA done';
    },
    'zygisk_next.sh': (o, c) => {
      if (c !== 0) return extractError(o) || 'Zygisk Next not found';
      const s = extractValue(o, /(\d+)\/3 settings applied/);
      if (s) return `Zygisk: ${s}/3 set`;
      if (o.includes('too low')) return 'Zygisk: version too low';
      if (o.includes('not found')) return 'Zygisk Next not found';
      return 'Zygisk Next configured';
    },
    'cleanup.sh': () => 'Cleanup completed',
    'kill_all.sh': (o) => {
      const c = extractValue(o, /Cleared (\d+) packages/);
      return c ? `Cleared ${c} packages` : 'Kill all done';
    },
    'restore_backups.sh': (o, c) => {
      if (c !== 0) return extractError(o) || 'No backups to restore';
      const r = extractValue(o, /Restored (\d+) files/);
      return r ? `Restored ${r} files` : 'Backups restored';
    },
    'boot_state_props.sh': (o) => {
      if (o.includes('No suspicious props found')) return 'No suspicious props';
      if (o.includes('Suspicious props detected')) return 'Suspicious props cleaned';
      return 'Boot props checked';
    },
    'widevine.sh': (o, c) => {
      if (c !== 0) return extractError(o) || 'Widevine failed';
      if (o.includes('KmInstallKeybox completed')) return 'Widevine: key installed';
      if (o.includes('not found')) return 'Widevine: no KmInstallKeybox';
      return 'Widevine done';
    },
    'check_tee_hash.sh': (o) => {
      const s = extractValue(o, /tee_status=(\w+)/);
      if (s === 'normal') {
        const h = extractValue(o, /tee_hash=([a-f0-9]+)/);
        return h ? `TEE normal · ${h.slice(0, 8)}` : 'TEE normal';
      }
      if (s === 'broken') return 'TEE broken';
      if (s === 'error') return 'TEE check error';
      return 'TEE check done';
    },
    'boot_hash.sh': (o, c) => {
      if (c !== 0) return extractError(o) || 'Boot hash failed';
      const src = extractValue(o, /\[BOOT_HASH\].*Source:\s*(.+)$/im);
      return src ? `Boot hash: ${src}` : 'Boot hash set';
    },
  };

  function getScriptDescription(script: string, output: string): string {
    const m = output.match(/exited \(code: (\d+)\)/);
    const code = m ? parseInt(m[1] ?? '') : (output.includes('[!]') ? 1 : 0);
    const desc = DESCRIPTION_EXTRACTORS[script]?.(output, code);
    if (desc) return desc.slice(0, 50);

    // Fallback: pick first meaningful line
    for (const line of output.split('\n')) {
      const cleaned = line.trim().replace(/^\[[A-Z_]+\]\s*/, '');
      if (!cleaned) continue;
      if (/^(Start|Finish|Done|OK|Success|Failed|Error|Exit)/i.test(cleaned)) continue;
      return cleaned.slice(0, 50);
    }
    return '';
  }

  function createItem(entry: { script: string; output: string; time: string }): HTMLElement {
    const isError = (entry.output.includes('[!]') && !entry.output.includes('note:')) || entry.output.toLowerCase().includes('error');
    const i18nKey = getFriendlyNames()[entry.script];
    const friendlyName = (i18nKey && t(i18nKey, '')) || entry.script;
    const desc = getScriptDescription(entry.script, entry.output);
    const timeAgo = formatRelativeTime(entry.time);
    const statusIcon = isError ? 'error' : 'check_circle';
    const iconType = isError ? 'error' : 'success';

    const item = document.createElement('div');
    item.className = 'recent-activity-item';
    item.innerHTML = `
      <div class="recent-activity-item-icon recent-activity-item-icon--${iconType}">
        <md-icon aria-hidden="true">${statusIcon}</md-icon>
      </div>
      <div class="recent-activity-item-content">
        <p class="recent-activity-item-title">${escapeHtml(friendlyName)}</p>
        <p class="recent-activity-item-desc">${escapeHtml(desc)}</p>
      </div>
      <span class="recent-activity-item-time">${timeAgo}</span>
      <md-icon-button class="recent-activity-copy-btn" aria-label="${t('history_copy', 'Copy')}">
        <md-icon>content_copy</md-icon>
      </md-icon-button>
    `;
    item.querySelector('.recent-activity-copy-btn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(entry.output).then(() => {
        showToast(t('history_copied', 'Copied!'), { icon: 'check_circle', type: 'success', autoCloseDelay: 2000 });
      }).catch(() => {
        showToast(t('history_copy_failed', 'Failed to copy'), { icon: 'error', type: 'error', autoCloseDelay: 2000 });
      });
    });
    return item;
  }

  const visible = Math.min(count, VISIBLE_COUNT);
  for (let i = 0; i < visible; i++) {
    const entry = allEntries[i];
    if (entry) container.appendChild(createItem(entry));
  }

  if (count > VISIBLE_COUNT) {
    const toggle = document.createElement('div');
    toggle.className = 'recent-activity-toggle';
    let expanded = false;
    let hiddenCreated = false;

    toggle.textContent = t('home_show_all', 'Show all') + ` (${count})`;

    toggle.addEventListener('click', () => {
      expanded = !expanded;
      if (expanded && !hiddenCreated) {
        for (let i = VISIBLE_COUNT; i < count; i++) {
          const entry = allEntries[i];
          if (entry) container.insertBefore(createItem(entry), toggle);
        }
        hiddenCreated = true;
      }
      const hiddenEls = container.querySelectorAll('.recent-activity-item');
      hiddenEls.forEach((el, idx) => {
        (el as HTMLElement).style.display = idx >= VISIBLE_COUNT ? (expanded ? '' : 'none') : '';
      });
      toggle.textContent = expanded
        ? t('home_show_less', 'Show less')
        : (t('home_show_all', 'Show all') + ` (${count})`);
    });

    container.appendChild(toggle);
  }
}
