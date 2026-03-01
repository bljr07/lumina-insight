/**
 * Phase 6 RED Tests — Federated Weight Update
 *
 * Tests for anonymous weight update generation and idle-only sync.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateWeightUpdate,
  shouldSync,
  syncWeights,
} from '@background/federated.js';

// ─── generateWeightUpdate() ────────────────────────────────────────────────────

describe('generateWeightUpdate()', () => {
  it('should return a valid JSON object', () => {
    const localWeights = [0.1, 0.5, -0.3, 0.8];
    const update = generateWeightUpdate(localWeights);

    expect(update).toBeDefined();
    expect(typeof update).toBe('object');
  });

  it('should include model version and weights in the payload', () => {
    const localWeights = [0.1, 0.5, -0.3, 0.8];
    const update = generateWeightUpdate(localWeights);

    expect(update).toHaveProperty('model_version');
    expect(update).toHaveProperty('weights');
    expect(update.weights).toEqual(localWeights);
  });

  it('should contain NO PII (no domain, no timestamps, no user ID)', () => {
    const localWeights = [0.1, 0.5];
    const update = generateWeightUpdate(localWeights);

    expect(update).not.toHaveProperty('domain');
    expect(update).not.toHaveProperty('user_id');
    expect(update).not.toHaveProperty('email');
    expect(update).not.toHaveProperty('name');
  });

  it('should include a anonymous session hash', () => {
    const localWeights = [0.1, 0.5];
    const update = generateWeightUpdate(localWeights);

    expect(update).toHaveProperty('session_hash');
    expect(typeof update.session_hash).toBe('string');
    expect(update.session_hash.length).toBeGreaterThan(0);
  });
});

// ─── shouldSync() ──────────────────────────────────────────────────────────────

describe('shouldSync()', () => {
  it('should return true when system is idle', async () => {
    chrome.idle._setState('idle');

    const result = await shouldSync();
    expect(result).toBe(true);
  });

  it('should return false when system is active', async () => {
    chrome.idle._setState('active');

    const result = await shouldSync();
    expect(result).toBe(false);
  });

  it('should return false when system is locked', async () => {
    chrome.idle._setState('locked');

    const result = await shouldSync();
    expect(result).toBe(false);
  });
});

// ─── syncWeights() ─────────────────────────────────────────────────────────────

describe('syncWeights()', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    );
  });

  it('should make a single POST to the endpoint (UAC 3)', async () => {
    const update = generateWeightUpdate([0.1, 0.5]);
    const endpoint = 'https://api.lumina-insight.dev/federated/update';

    await syncWeights(update, endpoint);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(update),
      })
    );
  });

  it('should not sync during active study session', async () => {
    chrome.idle._setState('active');

    const update = generateWeightUpdate([0.1]);
    const endpoint = 'https://api.lumina-insight.dev/federated/update';

    const result = await syncWeights(update, endpoint, { checkIdle: true });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ synced: false, reason: 'not_idle' });
  });

  it('should handle network error gracefully', async () => {
    fetchSpy.mockImplementation(() => Promise.reject(new Error('Network error')));

    const update = generateWeightUpdate([0.1]);
    const endpoint = 'https://api.lumina-insight.dev/federated/update';

    const result = await syncWeights(update, endpoint);

    expect(result).toEqual(
      expect.objectContaining({
        synced: false,
        error: expect.any(String),
      })
    );
  });
});
