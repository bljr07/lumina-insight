var LuminaSidePanel = (function (exports) {
  'use strict';

  /**
   * Shared constants for Lumina Insight
   *
   * Learning states, platform types, and message types used across all layers.
   */

  /** Possible inferred learning states */
  const LearningState = Object.freeze({
    PENDING_LOCAL_AI: 'PENDING_LOCAL_AI',
    FOCUSED: 'FOCUSED',
    STALLED: 'STALLED',
    STRUGGLING: 'STRUGGLING',
    DEEP_READING: 'DEEP_READING',
    RE_READING: 'RE_READING',
  });

  /** Message types for chrome.runtime.sendMessage routing */
  const MessageType = Object.freeze({
    BEHAVIORAL_PACKET: 'BEHAVIORAL_PACKET',
    INFERENCE_REQUEST: 'INFERENCE_REQUEST',
    INFERENCE_RESULT: 'INFERENCE_RESULT',
    GENERATE_NUDGE: 'GENERATE_NUDGE',
    GET_STATE: 'GET_STATE',
    STATE_UPDATED: 'STATE_UPDATED',
    HEARTBEAT: 'HEARTBEAT',
  });

  /**
   * Nudge Logic — Translates raw LearningState into user-friendly messages
   *
   * This pure function powers the Side Panel content.
   */

  /**
   * Maps an inferred learning state to a UI nudge object.
   *
   * @param {string} state - The LearningState enum value
   * @returns {{ title: string, message: string, type: string }} Nudge data
   */
  function mapStateToNudge(state) {
    switch (state) {
      case LearningState.STRUGGLING:
        return {
          type: 'struggling',
          title: 'Take a Breath',
          message: "It looks like you might be stuck. Let's break this problem down into smaller steps.",
        };
      
      case LearningState.STALLED:
        return {
          type: 'stalled',
          title: 'Need a Hint?',
          message: "You've been on this for a while. Try reviewing the previous section for clues.",
        };

      case LearningState.FOCUSED:
        return {
          type: 'focused',
          title: 'On Fire!',
          message: "You're doing great! Keep up the momentum.",
        };

      case LearningState.DEEP_READING:
        return {
          type: 'deep-reading',
          title: 'Deep Focus',
          message: 'Great focus on the reading material. Take notes if you find anything complex!',
        };

      case LearningState.RE_READING:
        return {
          type: 're-reading',
          title: 'Reviewing',
          message: 'Connecting the dots is great. Re-reading helps solidify complex concepts.',
        };

      case LearningState.PENDING_LOCAL_AI:
        return {
          type: 'pending',
          title: 'Analyzing...',
          message: 'Lumina is gathering insights on your learning patterns.',
        };

      default:
        // Includes null/undefined and unrecognized states
        return {
          type: 'idle',
          title: 'Idle',
          message: 'Browse to a supported learning platform to start receiving insights.',
        };
    }
  }

  /**
   * Side Panel Main — Lumina Insight
   *
   * Fetches the current learning state from the Service Worker
   * and renders a supportive nudge in the UI.
   */

  // ─── Constants ─────────────────────────────────────────────────────────────────

  // All possible theme classes to clear before setting a new one
  const ALL_THEMES = [
    'theme-focused',
    'theme-struggling',
    'theme-stalled',
    'theme-deep-reading',
    'theme-re-reading',
    'theme-pending',
    'theme-idle'
  ];

  /** Emojis mappings relative to nudge types */
  const ICONS = {
    'focused': '🎯',
    'struggling': '😰',
    'stalled': '⏸️',
    'deep-reading': '📖',
    're-reading': '🔄',
    'pending': '⏳',
    'idle': '👋'
  };

  // ─── Rendering ─────────────────────────────────────────────────────────────────

  /**
   * Renders the given learning state into the side panel by
   * updating text content and body theme classes.
   *
   * @param {string|null} state 
   * @param {object|null} [dynamicNudge] 
   */
  function renderNudge(state, dynamicNudge = null) {
    const nudge = dynamicNudge || mapStateToNudge(state);

    // Update DOM Elements
    const titleEl = document.getElementById('nudge-title');
    const messageEl = document.getElementById('nudge-message');
    const iconEl = document.getElementById('nudge-icon');

    if (titleEl) titleEl.textContent = nudge.title;
    if (messageEl) messageEl.textContent = nudge.message;
    if (iconEl) iconEl.textContent = ICONS[nudge.type] || '👋';

    // Update Theme Class on body
    document.body.classList.remove(...ALL_THEMES);
    document.body.classList.add(`theme-${nudge.type}`);
  }

  // ─── Initialization ────────────────────────────────────────────────────────────

  /**
   * Initializes the side panel by asking the Service Worker
   * for the current session state.
   */
  async function initSidePanel() {
    try {
      const response = await chrome.runtime.sendMessage({ type: MessageType.GET_STATE });
      const lastState = response ? response.lastState : null;
      const lastNudge = response ? response.lastNudge : null;
      console.debug('[Lumina SP] Received state on init:', lastState, lastNudge);
      renderNudge(lastState, lastNudge);
    } catch (err) {
      console.error('[Lumina SP] Failed to init, fallback to Idle. Err:', err);
      renderNudge(null); // Fallback securely
    }
  }

  // ─── Message Listener ──────────────────────────────────────────────────────────

  /**
   * Listen for real-time state updates broadcasted by the Service Worker.
   */
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === MessageType.STATE_UPDATED) {
      console.debug('[Lumina SP] Received live state update:', message.payload);
      
      // Backwards compatibility for testing / old payloads
      if (typeof message.payload === 'object' && message.payload !== null && message.payload.state) {
        renderNudge(message.payload.state, message.payload.nudge);
      } else {
        renderNudge(message.payload);
      }
    }
  });

  // ─── Auto-initialize ───────────────────────────────────────────────────────────
  const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';
  if (!isTestEnv && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initSidePanel);
    } else {
      initSidePanel();
    }
  }

  exports.initSidePanel = initSidePanel;
  exports.renderNudge = renderNudge;

  return exports;

})({});
