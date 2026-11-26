import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  spawnAndWait: vi.fn(async () => {}),
}));

vi.mock('./bridge.js', () => ({
  runScript: vi.fn(async () => ({ success: true, output: '', rawOutput: '' })),
  spawnScript: vi.fn(),
  spawnScriptAndWait: state.spawnAndWait,
}));

vi.mock('./utils.js', async () => {
  const actual = await vi.importActual<typeof import('./utils.js')>('./utils.js');
  return {
    ...actual,
    fetchJson: state.fetchJson,
  };
});

import { refreshKeyboxWatch } from './device.js';

describe('keybox watch refresh', () => {
  beforeEach(() => {
    (window as any).__keyboxInfoPromise = null;
    state.fetchJson.mockReset();
    state.spawnAndWait.mockReset().mockResolvedValue(undefined);
  });

  it('skips the shell when the snapshot is fresh', async () => {
    state.fetchJson.mockResolvedValue({
      installed: true,
      checked_at: new Date().toISOString(),
    });

    await refreshKeyboxWatch();

    expect(state.spawnAndWait).not.toHaveBeenCalled();
  });

  it('runs the watch when the snapshot is stale', async () => {
    state.fetchJson
      .mockResolvedValueOnce({ installed: true, checked_at: '2000-01-01T00:00:00Z' })
      .mockResolvedValueOnce({
        installed: true,
        checked_at: new Date().toISOString(),
        revoked: true,
        revocation_status: 'REVOKED',
      });

    const data = await refreshKeyboxWatch();

    expect(state.spawnAndWait).toHaveBeenCalledWith('keybox_watch.sh', 'feature');
    expect(data?.revoked).toBe(true);
  });

  it('propagates a failed watch so the page can report it', async () => {
    state.fetchJson.mockResolvedValue({ installed: true, checked_at: '2000-01-01T00:00:00Z' });
    state.spawnAndWait.mockRejectedValue(new Error('watch down'));

    await expect(refreshKeyboxWatch()).rejects.toThrow('watch down');
  });
});
