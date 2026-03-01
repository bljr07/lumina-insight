/**
 * Phase W3 RED Tests — Popup Main Entry
 *
 * Integration tests for the popup UI wiring.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initPopup, renderState } from '@popup/main.js';
import { MessageType, LearningState } from '@shared/constants.js';

describe('initPopup()', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="popup-container">
        <h1>Lumina Insight</h1>
        <div id="state-display" data-testid="state-display">--</div>
        <div id="platform-display" data-testid="platform-display">--</div>
        <div id="packet-count" data-testid="packet-count">0</div>
        <div id="status" data-testid="status">Loading...</div>
      </div>
    `;
  });

  it('should send GET_STATE to the service worker on init', async () => {
    // Mock sendMessage to return a promise
    chrome.runtime.sendMessage.mockResolvedValue({ lastState: null, packetCount: 0 });

    await initPopup();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: MessageType.GET_STATE }
    );
  });

  it('should update status element after receiving state', async () => {
    // Mock sendMessage to return session data
    chrome.runtime.sendMessage.mockResolvedValue({
      lastState: LearningState.FOCUSED,
      packetCount: 12,
      latestPacket: { context: { domain: 'kahoot.it', type: 'QUIZ' } },
    });

    await initPopup();

    const status = document.getElementById('status');
    expect(status.textContent).toBe('Monitoring active');
  });
});

describe('renderState()', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="popup-container">
        <div id="state-display">--</div>
        <div id="platform-display">--</div>
        <div id="packet-count">0</div>
        <div id="status">Loading...</div>
      </div>
    `;
  });

  it('should display the learning state', () => {
    renderState({
      lastState: LearningState.FOCUSED,
      packetCount: 5,
      latestPacket: { context: { domain: 'kahoot.it', type: 'QUIZ' } },
    });

    const stateEl = document.getElementById('state-display');
    expect(stateEl.textContent).toContain('Focused');
  });

  it('should display the platform name', () => {
    renderState({
      lastState: LearningState.STRUGGLING,
      packetCount: 3,
      latestPacket: { context: { domain: 'canvas', type: 'LMS_READING' } },
    });

    const platformEl = document.getElementById('platform-display');
    expect(platformEl.textContent).toContain('canvas');
  });

  it('should display the packet count', () => {
    renderState({
      lastState: LearningState.FOCUSED,
      packetCount: 42,
    });

    const countEl = document.getElementById('packet-count');
    expect(countEl.textContent).toContain('42');
  });

  it('should handle null/undefined session gracefully', () => {
    renderState(null);

    const status = document.getElementById('status');
    expect(status.textContent).toContain('Browse a page');
  });

  it('should handle empty session (no packets yet)', () => {
    renderState({ lastState: null, packetCount: 0 });

    const stateEl = document.getElementById('state-display');
    expect(stateEl.textContent).toContain('Idle');
  });
});
