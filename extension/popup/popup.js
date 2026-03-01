var LuminaPopup = (function (exports) {
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
    QUEUE_STATUS_REQUEST: 'QUEUE_STATUS_REQUEST',
    QUEUE_STATUS_UPDATED: 'QUEUE_STATUS_UPDATED',
    QUEUE_FLUSH_REQUEST: 'QUEUE_FLUSH_REQUEST',
    HEARTBEAT: 'HEARTBEAT',
  });

  /**
   * Popup Main — Learning State Display
   *
   * Requests the current session state from the Service Worker
   * and renders it in the popup UI.
   */

  // ─── State Labels ──────────────────────────────────────────────────────────────

  const STATE_LABELS = {
    [LearningState.FOCUSED]: { label: 'Focused', class: 'state-pill state-focused' },
    [LearningState.STRUGGLING]: { label: 'Struggling', class: 'state-pill state-struggling' },
    [LearningState.STALLED]: { label: 'Stalled', class: 'state-pill state-stalled' },
    [LearningState.DEEP_READING]: { label: 'Deep Reading', class: 'state-pill state-deep-reading' },
    [LearningState.RE_READING]: { label: 'Re-Reading', class: 'state-pill state-re-reading' },
    [LearningState.PENDING_LOCAL_AI]: { label: 'Analyzing...', class: 'state-pill state-pending' },
  };

  // ─── Rendering ─────────────────────────────────────────────────────────────────

  /**
   * Render the session state into the popup DOM.
   *
   * @param {object|null} session - Session data from the service worker
   */
  function renderState(session) {
    const stateEl = document.getElementById('state-display');
    const platformEl = document.getElementById('platform-display');
    const countEl = document.getElementById('packet-count');
    const statusEl = document.getElementById('status');

    if (!session) {
      statusEl.textContent = 'Browse a page to start monitoring';
      stateEl.textContent = 'No data yet';
      stateEl.className = 'state-pill state-idle';
      platformEl.textContent = '--';
      countEl.textContent = '0';
      return;
    }

    // Learning state
    if (session.lastState && STATE_LABELS[session.lastState]) {
      const stateInfo = STATE_LABELS[session.lastState];
      stateEl.textContent = stateInfo.label;
      stateEl.className = stateInfo.class;
    } else {
      stateEl.textContent = 'Idle';
      stateEl.className = 'state-pill state-idle';
    }

    // Platform
    if (session.latestPacket && session.latestPacket.context) {
      platformEl.textContent = session.latestPacket.context.domain || '--';
    } else {
      platformEl.textContent = '--';
    }

    // Packet count
    countEl.textContent = String(session.packetCount || 0);

    // Status
    statusEl.textContent = 'Monitoring active';
  }

  // ─── Initialization ────────────────────────────────────────────────────────────

  /**
   * Initialize the popup: request state and render.
   */
  async function initPopup() {
    try {
      const response = await chrome.runtime.sendMessage({ type: MessageType.GET_STATE });
      console.debug('[Lumina Popup] Received state:', response);
      renderState(response);
    } catch (err) {
      console.error('[Lumina Popup] Failed to get state from service worker:', err);
      renderState(null);
    }
  }

  // ─── Message Listener ──────────────────────────────────────────────────────────

  /**
   * Listen for real-time state updates broadcasted by the Service Worker.
   */
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === MessageType.STATE_UPDATED) {
      console.debug('[Lumina Popup] Received live state update:', message.payload);
      // Re-fetch full session to get packet count & context alongside the new state
      chrome.runtime.sendMessage({ type: MessageType.GET_STATE }).then((session) => {
        if (session) {
          // Merge the live state update into the full session
          session.lastState = (message.payload && message.payload.state) || message.payload;
          renderState(session);
        }
      }).catch(() => {
        // Fallback: render with minimal info
        renderState({ lastState: (message.payload && message.payload.state) || message.payload });
      });
    }
  });

  // ─── Auto-initialize ───────────────────────────────────────────────────────────
  const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';
  if (!isTestEnv && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPopup);
    } else {
      initPopup();
    }
  }

  exports.initPopup = initPopup;
  exports.renderState = renderState;

  return exports;

})({});
