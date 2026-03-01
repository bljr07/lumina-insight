/**
 * Content Script Main — Wires sensors, platform detection, and packet emission
 *
 * This is the main entry point for the content script. It:
 * 1. Detects the current learning platform
 * 2. Initializes behavioral sensors (dwell, scroll, jitter, tab switch)
 * 3. Emits throttled behavioral packets to the Service Worker
 */
import { detectPlatform, detectQuizElements } from './platforms.js';
import { DwellTracker, ScrollTracker, MouseJitterTracker, TabSwitchTracker, ReReadDetector } from './sensors.js';
import { throttle } from './throttle.js';
import { initReReadObserver, disconnectObserver } from './observer.js';
import { createPacket, sanitizePacket } from '@shared/packet.js';
import { MessageType, SensorConfig } from '@shared/constants.js';

// ─── Module State ──────────────────────────────────────────────────────────────

let _sensors = null;
let _platform = null;
let _emitThrottled = null;
let _handlers = null;

// ─── Packet Emission ───────────────────────────────────────────────────────────

function emitPacket() {
  if (!_sensors || !_platform) return;

  try {
    const metrics = {
      dwell_time_ms: _sensors.dwell.get(),
      scroll_velocity: _sensors.scroll.getVelocity(),
      mouse_jitter: _sensors.jitter.getJitter(),
      tab_switches: _sensors.tabSwitch.getCount(),
      re_read_cycles: _sensors.reRead.getCycles(),
    };

    const transient_content = _sensors.reRead.getTransientContent();
    const packet = createPacket(_platform, metrics, transient_content);

    chrome.runtime.sendMessage({
      type: MessageType.BEHAVIORAL_PACKET,
      payload: packet,
    });

    // Reset sensors after emission so metrics reflect the current window only
    _sensors.dwell.reset();
    _sensors.dwell.start();
    _sensors.jitter.reset();
    _sensors.tabSwitch.reset();
  } catch (err) {
    // Silently ignore — don't disrupt the user's page
    console.debug('[Lumina] Packet emission error:', err.message);
  }
}

// ─── Event Handlers ────────────────────────────────────────────────────────────

function onMouseMove(event) {
  _sensors.jitter.onMove(event.clientX, event.clientY);
  _emitThrottled();
}

function onScroll() {
  _sensors.scroll.onScroll(window.scrollY);
  _emitThrottled();
}

function onVisibilityChange() {
  _sensors.tabSwitch.onVisibilityChange(document.hidden);
}

// ─── Init / Teardown ───────────────────────────────────────────────────────────

/**
 * Initialize the content script: detect platform, start sensors, attach listeners.
 *
 * @returns {{ platform: object, sensors: object }} Current state for testing
 */
export function initContentScript() {
  // Detect platform
  _platform = detectPlatform(window.location.href);

  // Initialize sensors
  _sensors = {
    dwell: new DwellTracker(),
    scroll: new ScrollTracker(),
    jitter: new MouseJitterTracker(),
    tabSwitch: new TabSwitchTracker(),
    reRead: new ReReadDetector(),
  };

  // Start dwell tracking immediately
  _sensors.dwell.start();

  // Create throttled emitter
  _emitThrottled = throttle(emitPacket, SensorConfig.THROTTLE_INTERVAL_MS);

  // Store handler references for cleanup
  _handlers = { onMouseMove, onScroll, onVisibilityChange };

  // Attach event listeners
  document.addEventListener('mousemove', _handlers.onMouseMove);
  document.addEventListener('visibilitychange', _handlers.onVisibilityChange);
  window.addEventListener('scroll', _handlers.onScroll);

  // Detect quiz elements on the page
  const quizElements = detectQuizElements(document, _platform.domain);
  
  let targetElements = [];
  if (quizElements.length > 0) {
    targetElements = quizElements;
  } else {
    // Fallback: track standard reading paragraphs
    targetElements = Array.from(document.querySelectorAll('p, article, li'));
  }

  if (targetElements.length > 0) {
    initReReadObserver(_sensors.reRead, targetElements);
    console.debug(`[Lumina] Observing ${targetElements.length} elements for re-read tracking on ${_platform.domain}`);
  }

  console.debug(`[Lumina] Content script initialized — platform: ${_platform.domain} (${_platform.type})`);

  return { platform: _platform, sensors: _sensors };
}

/**
 * Stop the content script: remove listeners, stop sensors.
 */
export function stopContentScript() {
  if (_handlers) {
    document.removeEventListener('mousemove', _handlers.onMouseMove);
    document.removeEventListener('visibilitychange', _handlers.onVisibilityChange);
    window.removeEventListener('scroll', _handlers.onScroll);
    _handlers = null;
  }

  if (_sensors) {
    _sensors.dwell.stop();
    _sensors = null;
  }

  disconnectObserver();

  _platform = null;
  _emitThrottled = null;
}

// ─── Auto-initialize when loaded as content script ─────────────────────────────
const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';
if (!isTestEnv && typeof window !== 'undefined' && typeof chrome !== 'undefined' && chrome.runtime) {
  initContentScript();
}
