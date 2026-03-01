/**
 * Popup Main — Learning State Display
 *
 * Requests the current session state from the Service Worker
 * and renders it in the popup UI.
 */
import { MessageType, LearningState } from '@shared/constants.js';

// ─── State Labels ──────────────────────────────────────────────────────────────

const STATE_LABELS = {
  [LearningState.FOCUSED]: { label: '🎯 Focused', class: 'state-focused' },
  [LearningState.STRUGGLING]: { label: '😰 Struggling', class: 'state-struggling' },
  [LearningState.STALLED]: { label: '⏸️ Stalled', class: 'state-stalled' },
  [LearningState.DEEP_READING]: { label: '📖 Deep Reading', class: 'state-deep-reading' },
  [LearningState.RE_READING]: { label: '🔄 Re-Reading', class: 'state-re-reading' },
  [LearningState.PENDING_LOCAL_AI]: { label: '⏳ Analyzing...', class: 'state-pending' },
};

// ─── Rendering ─────────────────────────────────────────────────────────────────

/**
 * Render the session state into the popup DOM.
 *
 * @param {object|null} session - Session data from the service worker
 */
export function renderState(session) {
  const stateEl = document.getElementById('state-display');
  const platformEl = document.getElementById('platform-display');
  const countEl = document.getElementById('packet-count');
  const statusEl = document.getElementById('status');

  if (!session) {
    statusEl.textContent = 'Browse a page to start monitoring';
    stateEl.textContent = 'No data yet';
    stateEl.className = 'state-idle';
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
    stateEl.className = 'state-idle';
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
export async function initPopup() {
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
