import { t } from './i18n.js';
import { showToast } from './toast.js';
import { afterNextPaint } from './utils.js';

const BUSY_CLASS = 'reload-btn--busy';

export async function runAsyncReload(
  button: HTMLElement,
  reload: () => Promise<unknown>,
  label = 'Reload',
): Promise<void> {
  button.setAttribute('disabled', '');
  button.classList.add(BUSY_CLASS);
  await afterNextPaint();
  try {
    await reload();
  } catch (e) {
    console.warn(`${label} failed:`, e);
    showToast(t('toast_failed_update', 'Failed to update'), {
      icon: 'error',
      type: 'error',
      autoCloseDelay: 3000,
    });
  } finally {
    button.removeAttribute('disabled');
    button.classList.remove(BUSY_CLASS);
  }
}
