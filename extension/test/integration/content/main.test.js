/**
 * Phase W1 RED Tests — Content Script Main Entry
 *
 * Integration tests for the wired-up content script that combines
 * sensors, platform detection, throttling, and packet emission.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initContentScript, stopContentScript } from '@content/main.js';
import { MessageType, LearningState } from '@shared/constants.js';

describe('initContentScript()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    stopContentScript();
    vi.useRealTimers();
  });

  it('should detect platform from current URL', () => {
    // jsdom default URL is about:blank — should detect as UNKNOWN
    const result = initContentScript();

    expect(result.platform).toBeDefined();
    expect(result.platform.type).toBeDefined();
  });

  it('should start the dwell tracker on init', () => {
    const result = initContentScript();

    expect(result.sensors.dwell).toBeDefined();

    // Advance time — dwell should be tracking
    vi.advanceTimersByTime(500);
    expect(result.sensors.dwell.get()).toBeGreaterThanOrEqual(500);
  });

  it('should register mouse, scroll, and visibility event listeners', () => {
    const addEventSpy = vi.spyOn(document, 'addEventListener');
    const windowAddEventSpy = vi.spyOn(window, 'addEventListener');

    initContentScript();

    // Should have registered mousemove, scroll, and visibilitychange
    const docEvents = addEventSpy.mock.calls.map((c) => c[0]);
    const winEvents = windowAddEventSpy.mock.calls.map((c) => c[0]);

    expect(docEvents).toContain('mousemove');
    expect(docEvents).toContain('visibilitychange');
    expect(winEvents).toContain('scroll');

    addEventSpy.mockRestore();
    windowAddEventSpy.mockRestore();
  });

  it('should emit a behavioral packet via chrome.runtime.sendMessage', () => {
    initContentScript();

    // Simulate user interaction: mouse movement
    const moveEvent = new MouseEvent('mousemove', { clientX: 100, clientY: 200 });
    document.dispatchEvent(moveEvent);

    // Advance past throttle interval
    vi.advanceTimersByTime(200);

    // Simulate a scroll event
    Object.defineProperty(window, 'scrollY', { value: 500, configurable: true });
    window.dispatchEvent(new Event('scroll'));

    // Advance time to trigger packet emission
    vi.advanceTimersByTime(1000);

    // Check that sendMessage was called with a behavioral packet
    const sendCalls = chrome.runtime.sendMessage.mock.calls;
    const packetCalls = sendCalls.filter(
      (call) => call[0] && call[0].type === MessageType.BEHAVIORAL_PACKET
    );

    expect(packetCalls.length).toBeGreaterThanOrEqual(1);

    // Verify packet shape
    const packet = packetCalls[0][0].payload;
    expect(packet).toHaveProperty('context');
    expect(packet).toHaveProperty('metrics');
    expect(packet).toHaveProperty('inferred_state', LearningState.PENDING_LOCAL_AI);
  });

  it('should throttle packet emission (max 1 per interval)', () => {
    initContentScript();

    // Rapid mouse movements within 100ms
    for (let i = 0; i < 10; i++) {
      const moveEvent = new MouseEvent('mousemove', {
        clientX: 100 + i,
        clientY: 200 + i,
      });
      document.dispatchEvent(moveEvent);
      vi.advanceTimersByTime(10); // 10ms each = 100ms total
    }

    // Within the first 100ms window, at most 1 packet should emit
    // (the emission timer may not have fired yet)
    const sendCalls = chrome.runtime.sendMessage.mock.calls;
    const packetCalls = sendCalls.filter(
      (call) => call[0] && call[0].type === MessageType.BEHAVIORAL_PACKET
    );

    // At most 2 (1 immediate + 1 trailing after throttle)
    expect(packetCalls.length).toBeLessThanOrEqual(2);
  });

  it('should clean up listeners on stopContentScript()', () => {
    const removeEventSpy = vi.spyOn(document, 'removeEventListener');
    const windowRemoveEventSpy = vi.spyOn(window, 'removeEventListener');

    initContentScript();
    stopContentScript();

    expect(removeEventSpy).toHaveBeenCalled();
    expect(windowRemoveEventSpy).toHaveBeenCalled();

    removeEventSpy.mockRestore();
    windowRemoveEventSpy.mockRestore();
  });

  it('should track tab switches via visibilitychange', () => {
    const result = initContentScript();

    // Simulate tab switch: hidden then visible
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(result.sensors.tabSwitch.getCount()).toBe(1);
  });
});
