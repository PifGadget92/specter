import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  showToast: vi.fn(),
}));

vi.mock('./toast.js', () => ({
  showToast: state.showToast,
}));

import { runAsyncReload } from './async-reload.js';

describe('runAsyncReload', () => {
  it('marks the button busy before the reload starts and restores it after', async () => {
    const button = document.createElement('button');
    const reload = vi.fn(async () => {});

    const pending = runAsyncReload(button, reload);

    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.classList.contains('reload-btn--busy')).toBe(true);
    expect(reload).not.toHaveBeenCalled();

    await pending;
    expect(reload).toHaveBeenCalledTimes(1);
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.classList.contains('reload-btn--busy')).toBe(false);
  });

  it('restores the button and toasts when the reload rejects', async () => {
    const button = document.createElement('button');
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await runAsyncReload(button, async () => { throw new Error('boom'); }, 'Test reload');

    expect(console.warn).toHaveBeenCalledWith('Test reload failed:', expect.any(Error));
    expect(state.showToast).toHaveBeenCalledWith(
      'Failed to update',
      expect.objectContaining({ icon: 'error', type: 'error' }),
    );
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.classList.contains('reload-btn--busy')).toBe(false);
  });
});
