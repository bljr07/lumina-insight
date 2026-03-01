/**
 * Phase SP RED Tests — Side Panel Integration
 *
 * Simulates side panel lifecycle, messaging, and DOM updates.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initSidePanel, renderNudge } from '@sidepanel/main.js';
import { MessageType, LearningState } from '@shared/constants.js';

describe('Side Panel Integration', () => {
  beforeEach(() => {
    // Scaffold minimal side panel DOM
    document.body.innerHTML = `
      <div id="nudge-icon"></div>
      <div id="nudge-title"></div>
      <div id="nudge-message"></div>
    `;

    // Clear body class
    document.body.className = '';

    global.chrome = {
      runtime: {
        sendMessage: vi.fn(),
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('renderNudge()', () => {
    it('should update DOM and class based on LearningState', () => {
      renderNudge(LearningState.STRUGGLING);

      expect(document.getElementById('nudge-title').textContent).toBe('Take a Breath');
      expect(document.getElementById('nudge-message').textContent).toContain('smaller steps');
      
      // Should clear old classes and apply new theme class
      expect(document.body.classList.contains('theme-struggling')).toBe(true);
    });

    it('should handle null session state gracefully', () => {
      renderNudge(null);

      expect(document.getElementById('nudge-title').textContent).toBe('Idle');
      expect(document.body.classList.contains('theme-idle')).toBe(true);
    });
  });

  describe('initSidePanel()', () => {
    it('should request state on init and render', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        lastState: LearningState.FOCUSED,
      });

      await initSidePanel();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: MessageType.GET_STATE });
      
      // Verify text was painted
      expect(document.getElementById('nudge-title').textContent).toBe('On Fire!');
      expect(document.body.classList.contains('theme-focused')).toBe(true);
    });

    it('should fallback securely if service worker fails', async () => {
      chrome.runtime.sendMessage.mockRejectedValue(new Error('Extension context invalidated'));

      await initSidePanel();

      expect(document.getElementById('nudge-title').textContent).toBe('Idle');
      expect(document.body.classList.contains('theme-idle')).toBe(true);
    });
  });
});
