import '@material/web/button/filled-tonal-button.js';
import { exec, getModuleDir } from './bridge.js';
import { getTranslation } from './i18n.js';
import { wireRowDialog } from './toggles.js';
import { openSubPage } from './subpage.js';
import { cfgGet, cfgSet } from './cfg.js';
import { shellEscape } from './utils.js';

const t = (key: string, fallback: string): string => getTranslation(key) || fallback;

export async function openHmaDialog() {
  const currentMode = (await cfgGet('hma_launch_mode', 'prompt')) || 'prompt';

  openSubPage({
    id: 'hma-config',
    title: t('hma_dialog_title', 'HMA-OSS Configs'),
    description: t(
      'hma_dialog_desc',
      'Generates a custom HMA-OSS hiding profile from installed packages and merges it into the service configuration.'
    ),
    masterToggle: {
      key: 'toggle_action_hma',
      defaultVal: '1',
      title: t('control_toggle_action_hma_master', 'Use HMA-OSS Config Generation'),
      syncSwitchId: 'toggle-action_hma',
    },
    groups: [
      {
        title: t('hma_group_app_launch', 'App Launch Policy (Action Button)'),
        description: t(
          'hma_group_app_launch_desc',
          'Choose how Specter handles opening HMA-OSS to reload its configuration after generating rules.'
        ),
        items: [
          {
            type: 'radio',
            id: 'hma-launch-prompt',
            name: 'hma_launch_mode_radio',
            value: 'prompt',
            title: t('hma_launch_prompt', 'Prompt via Volume Keys (Default)'),
            description: t('hma_launch_prompt_desc', 'Ask with Volume UP (Open) or DOWN (Skip) in the interactive terminal'),
            selected: currentMode === 'prompt',
            onSelect: (val) => cfgSet('hma_launch_mode', val),
          },
          {
            type: 'radio',
            id: 'hma-launch-always',
            name: 'hma_launch_mode_radio',
            value: 'always',
            title: t('hma_launch_always', 'Auto-Accept (Always Open)'),
            description: t('hma_launch_always_desc', 'Automatically open HMA-OSS without asking for Volume key confirmation'),
            selected: currentMode === 'always',
            onSelect: (val) => cfgSet('hma_launch_mode', val),
          },
          {
            type: 'radio',
            id: 'hma-launch-never',
            name: 'hma_launch_mode_radio',
            value: 'never',
            title: t('hma_launch_never', 'Auto-Refuse (Never Open)'),
            description: t('hma_launch_never_desc', 'Never open HMA-OSS; save config silently until manual launch or reboot'),
            selected: currentMode === 'never',
            onSelect: (val) => cfgSet('hma_launch_mode', val),
          },
        ],
      },
      {
        title: t('hma_group_scope', 'Profile & Scope Options'),
        items: [
          {
            id: 'hma-target-user-apps',
            key: 'toggle_hma_target_user_apps',
            defaultVal: '1',
            icon: 'apps',
            title: t('hma_target_user_apps', 'Target All User Apps'),
            description: t('hma_target_user_apps_desc', 'Automatically add all installed 3rd-party user apps to the hiding scope'),
          },
          {
            id: 'hma-live-reload',
            key: 'toggle_hma_live_reload',
            defaultVal: '1',
            icon: 'touch_app',
            title: t('hma_live_reload', 'Automated Reload Gesture'),
            description: t('hma_live_reload_desc', 'Simulate status card long-press when HMA-OSS opens to trigger live reload'),
          },
          {
            id: 'hma-hide-xposed',
            key: 'toggle_hma_hide_xposed',
            defaultVal: '1',
            icon: 'extension',
            title: t('hma_hide_xposed', 'Hide Detected Xposed Modules'),
            description: t('hma_hide_xposed_desc', 'Reads xposedmodule metadata from installed apps and adds matches to the hide list.'),
          },
          {
            type: 'custom',
            render: async (container) => {
              container.innerHTML = `
                <div class="list-item list-item--last" style="flex-direction: column; align-items: stretch; gap: 10px; cursor: default;">
                  <div style="display: flex; align-items: center; gap: 14px;">
                    <div class="li-icon"><md-icon aria-hidden="true">manage_search</md-icon></div>
                    <div class="list-item-content">
                      <div class="toggle-text">${t('hma_xposed_title', 'Detected Xposed Modules')}</div>
                      <span class="supporting-text">${t('hma_xposed_desc', 'Manifest metadata scan across installed apps.')}</span>
                    </div>
                    <md-filled-tonal-button id="hma-xposed-scan">${t('hma_xposed_scan', 'Scan')}</md-filled-tonal-button>
                  </div>
                  <div id="hma-xposed-list" class="supporting-text" style="white-space: pre-wrap; font-family: ui-monospace, monospace; line-height: 1.5;"></div>
                </div>
              `;

              const btn = container.querySelector('#hma-xposed-scan') as HTMLElement | null;
              const list = container.querySelector('#hma-xposed-list') as HTMLElement | null;
              if (!btn || !list) return;

              const scan = async (refresh: boolean) => {
                btn.setAttribute('disabled', '');
                list.textContent = t('hma_xposed_scanning', 'Scanning installed apps...');
                try {
                  const moddir = getModuleDir();
                  if (!moddir) throw new Error('module directory unavailable');
                  const suffix = refresh ? ' --refresh' : '';
                  const { code, stdout, stderr } = await exec(
                    `sh ${shellEscape(moddir + '/features/xposed_scan.sh')}${suffix}`,
                  );
                  if (code !== 0) throw new Error(stderr.trim() || 'scan failed');
                  const lines = stdout.split('\n').map(s => s.trim()).filter(Boolean);
                  list.textContent = lines.length
                    ? lines.map(line => line.replace('\t', '  ·  ')).join('\n')
                    : t('hma_xposed_none', 'No Xposed modules detected.');
                } catch (e) {
                  list.textContent = e instanceof Error ? e.message : String(e);
                } finally {
                  btn.removeAttribute('disabled');
                }
              };

              btn.addEventListener('click', () => scan(true));
              await scan(false);
            },
          },
        ],
      },
    ],
    infoCard: {
      icon: 'info',
      title: t('hma_info_title', 'Hide List Location'),
      text: t('hma_info_text', 'Package definitions are loaded from /data/adb/specter/config/hma-hide-list.txt. You can edit this file to add or remove hidden root apps.'),
    },
  });
}

export function wireHma() {
  wireRowDialog('toggle-action_hma-row', openHmaDialog);
}
