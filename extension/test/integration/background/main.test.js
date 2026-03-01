/**
 * Phase W2 RED Tests — Service Worker Main Entry
 *
 * Integration tests for the wired service worker that combines
 * routing, storage, and offscreen management.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initServiceWorker } from '@background/main.js';
import { MessageType, LearningState } from '@shared/constants.js';

describe('initServiceWorker()', () => {
  it('should register an onMessage listener', () => {
    initServiceWorker();

    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should register an onInstalled listener', () => {
    initServiceWorker();

    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should handle BEHAVIORAL_PACKET messages end-to-end', async () => {
    initServiceWorker();

    // Get the registered message handler
    const handler = chrome.runtime.onMessage.addListener.mock.calls[0][0];

    const message = {
      type: MessageType.BEHAVIORAL_PACKET,
      payload: {
        context: { domain: 'kahoot.it', type: 'QUIZ' },
        metrics: { dwell_time_ms: 5000, scroll_velocity: 0, mouse_jitter: 0.3, tab_switches: 0 },
        inferred_state: LearningState.PENDING_LOCAL_AI,
        timestamp: Date.now(),
      },
    };

    const sendResponse = vi.fn();
    handler(message, {}, sendResponse);

    // Wait for async handler
    await new Promise((r) => setTimeout(r, 50));

    expect(sendResponse).toHaveBeenCalledWith({ received: true });
  });

  it('should handle GET_STATE messages', async () => {
    initServiceWorker();

    // Seed some state
    await chrome.storage.local.set({
      session: { lastState: LearningState.FOCUSED, packetCount: 5 },
    });

    const handler = chrome.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = vi.fn();

    handler({ type: MessageType.GET_STATE }, {}, sendResponse);

    await new Promise((r) => setTimeout(r, 50));

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ lastState: LearningState.FOCUSED })
    );
  });

  it('should handle HEARTBEAT messages', async () => {
    initServiceWorker();

    const handler = chrome.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = vi.fn();

    handler({ type: MessageType.HEARTBEAT }, {}, sendResponse);

    await new Promise((r) => setTimeout(r, 50));

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ alive: true })
    );
  });

  it('should initialize default session on install', async () => {
    initServiceWorker();

    const onInstalledHandler = chrome.runtime.onInstalled.addListener.mock.calls[0][0];
    onInstalledHandler({ reason: 'install' });

    await new Promise((r) => setTimeout(r, 50));

    expect(chrome.storage.local.set).toHaveBeenCalled();
  });
});
