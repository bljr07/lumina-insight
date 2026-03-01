/**
 * Phase 4 RED Tests — Offscreen Manager
 *
 * Tests for creating/closing the offscreen document that hosts AI inference.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ensureOffscreen, closeOffscreen, hasOffscreen } from '@background/offscreen-manager.js';

describe('ensureOffscreen()', () => {
  it('should call chrome.offscreen.createDocument when none exists', async () => {
    await ensureOffscreen();

    expect(chrome.offscreen.createDocument).toHaveBeenCalledTimes(1);
    expect(chrome.offscreen.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.any(String),
        reasons: expect.any(Array),
        justification: expect.any(String),
      })
    );
  });

  it('should NOT create a duplicate when one already exists', async () => {
    await ensureOffscreen(); // first
    await ensureOffscreen(); // second — should be a no-op

    expect(chrome.offscreen.createDocument).toHaveBeenCalledTimes(1);
  });
});

describe('closeOffscreen()', () => {
  it('should call chrome.offscreen.closeDocument', async () => {
    await ensureOffscreen();
    await closeOffscreen();

    expect(chrome.offscreen.closeDocument).toHaveBeenCalledTimes(1);
  });

  it('should allow reopening after close', async () => {
    await ensureOffscreen();
    await closeOffscreen();
    await ensureOffscreen(); // should succeed again

    expect(chrome.offscreen.createDocument).toHaveBeenCalledTimes(2);
  });
});

describe('hasOffscreen()', () => {
  it('should return false initially', async () => {
    const result = await hasOffscreen();
    expect(result).toBe(false);
  });

  it('should return true after creation', async () => {
    await ensureOffscreen();
    const result = await hasOffscreen();
    expect(result).toBe(true);
  });

  it('should return false after close', async () => {
    await ensureOffscreen();
    await closeOffscreen();
    const result = await hasOffscreen();
    expect(result).toBe(false);
  });
});
