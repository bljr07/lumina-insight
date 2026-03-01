/**
 * Side Panel Main — Lumina Insight
 *
 * Fetches the current learning state from the Service Worker
 * and renders a supportive nudge in the UI.
 */
import { MessageType } from '@shared/constants.js';
import { mapStateToNudge } from '@shared/nudge.js';

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
export function renderNudge(state, dynamicNudge = null) {
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
export async function initSidePanel() {
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
