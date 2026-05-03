import { escapeHtml } from './utils.js';

export function showErrorDialog(title, content) {
  const dialog = document.createElement('md-dialog');
  dialog.innerHTML = `
    <div slot="headline">${escapeHtml(title)}</div>
    <div slot="content"><div class="terminal"><pre>${escapeHtml(content)}</pre></div></div>
    <div slot="actions">
      <md-text-button class="dialog-close">Close</md-text-button>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => document.body.removeChild(dialog));
  dialog.show();
}
