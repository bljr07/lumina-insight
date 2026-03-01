/**
 * Phase 4 RED Tests — Storage Manager
 *
 * Tests for session persistence via chrome.storage.local.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { saveSession, loadSession, DEFAULT_SESSION } from '@background/storage.js';

describe('saveSession()', () => {
  it('should write session data to chrome.storage.local', async () => {
    const data = { lastState: 'FOCUSED', packetCount: 5 };

    await saveSession(data);

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      session: data,
    });
  });

  it('should resolve successfully', async () => {
    const data = { lastState: 'STALLED' };

    await expect(saveSession(data)).resolves.toBeUndefined();
  });
});

describe('loadSession()', () => {
  it('should return previously saved session', async () => {
    const data = { lastState: 'FOCUSED', packetCount: 10 };
    await saveSession(data);

    const loaded = await loadSession();

    expect(loaded).toEqual(data);
  });

  it('should return default session when nothing is stored', async () => {
    const loaded = await loadSession();

    expect(loaded).toEqual(DEFAULT_SESSION);
  });

  it('should call chrome.storage.local.get with correct key', async () => {
    await loadSession();

    expect(chrome.storage.local.get).toHaveBeenCalledWith('session');
  });
});

describe('DEFAULT_SESSION', () => {
  it('should have expected shape', () => {
    expect(DEFAULT_SESSION).toHaveProperty('lastState');
    expect(DEFAULT_SESSION).toHaveProperty('packetCount');
    expect(DEFAULT_SESSION.lastState).toBe(null);
    expect(DEFAULT_SESSION.packetCount).toBe(0);
  });
});
