/**
 * Behavioral Sensors — Interaction Tracking Classes
 *
 * Pure data-tracking classes that monitor learning behavior patterns.
 * No DOM injection — these just accumulate metrics from events.
 */
import { SensorConfig } from '@shared/constants.js';

// ─── DwellTracker ──────────────────────────────────────────────────────────────

/**
 * Tracks how long a student dwells on a particular element or page section.
 * Uses Date.now() for timing to work with fake timers in tests.
 */
export class DwellTracker {
  constructor() {
    this._startTime = null;
    this._accumulated = 0;
    this._running = false;
  }

  start() {
    if (!this._running) {
      this._startTime = Date.now();
      this._running = true;
    }
  }

  stop() {
    if (this._running) {
      this._accumulated += Date.now() - this._startTime;
      this._startTime = null;
      this._running = false;
    }
  }

  get() {
    if (this._running) {
      return this._accumulated + (Date.now() - this._startTime);
    }
    return this._accumulated;
  }

  reset() {
    this._startTime = null;
    this._accumulated = 0;
    this._running = false;
  }
}

// ─── ScrollTracker ─────────────────────────────────────────────────────────────

/**
 * Tracks scroll velocity in pixels/second.
 */
export class ScrollTracker {
  constructor() {
    this._lastPosition = null;
    this._lastTime = null;
    this._velocity = 0;
  }

  /**
   * Call on each scroll event with the current scrollY position.
   * @param {number} scrollY - Current vertical scroll position in pixels
   */
  onScroll(scrollY) {
    const now = Date.now();

    if (this._lastPosition !== null && this._lastTime !== null) {
      const dt = now - this._lastTime;
      if (dt > 0) {
        const distance = Math.abs(scrollY - this._lastPosition);
        this._velocity = (distance / dt) * 1000; // pixels per second
      }
    }

    this._lastPosition = scrollY;
    this._lastTime = now;
  }

  getVelocity() {
    return this._velocity;
  }

  reset() {
    this._lastPosition = null;
    this._lastTime = null;
    this._velocity = 0;
  }
}

// ─── MouseJitterTracker ────────────────────────────────────────────────────────

/**
 * Tracks mouse jitter — small, rapid, directionless movements that indicate
 * hesitation or frustration. Returns a normalized value [0, 1].
 *
 * Jitter is calculated as the average distance between consecutive mouse
 * positions, normalized against SensorConfig.MOUSE_JITTER_NORMALIZATION_MAX.
 */
export class MouseJitterTracker {
  constructor() {
    this._positions = [];
  }

  /**
   * Record a mouse position.
   * @param {number} x
   * @param {number} y
   */
  onMove(x, y) {
    this._positions.push({ x, y });
  }

  /**
   * Calculate normalized jitter [0, 1].
   * @returns {number}
   */
  getJitter() {
    if (this._positions.length < 2) {
      return 0;
    }

    let totalDistance = 0;
    for (let i = 1; i < this._positions.length; i++) {
      const dx = this._positions[i].x - this._positions[i - 1].x;
      const dy = this._positions[i].y - this._positions[i - 1].y;
      totalDistance += Math.sqrt(dx * dx + dy * dy);
    }

    const avgDistance = totalDistance / (this._positions.length - 1);
    const normalized = avgDistance / SensorConfig.MOUSE_JITTER_NORMALIZATION_MAX;

    return Math.min(normalized, 1.0);
  }

  reset() {
    this._positions = [];
  }
}

// ─── TabSwitchTracker ──────────────────────────────────────────────────────────

/**
 * Counts how many times the student switches away from and back to the tab.
 * Only counts complete hidden→visible transitions.
 */
export class TabSwitchTracker {
  constructor() {
    this._count = 0;
    this._wasHidden = false;
  }

  /**
   * Call on document visibilitychange events.
   * @param {boolean} isHidden - true when document becomes hidden
   */
  onVisibilityChange(isHidden) {
    if (isHidden) {
      this._wasHidden = true;
    } else if (this._wasHidden) {
      // visible after being hidden = completed tab switch
      this._count++;
      this._wasHidden = false;
    }
  }

  getCount() {
    return this._count;
  }

  reset() {
    this._count = 0;
    this._wasHidden = false;
  }
}

// ─── ReReadDetector ────────────────────────────────────────────────────────────

/**
 * Detects when a student scrolls back to re-read previously seen content.
 * Tracks per-element visibility cycles.
 *
 * A "re-read cycle" occurs when an element has been seen, left (scrolled away),
 * and then seen again.
 */
export class ReReadDetector {
  /**
   * @param {number} threshold - Number of re-read cycles to trigger an alert
   */
  constructor(threshold = SensorConfig.RE_READ_CYCLE_THRESHOLD) {
    this._threshold = threshold;
    this._elements = new Map(); // elementId → { seenCount, isVisible }
  }

  /**
   * Mark an element as currently visible (entered viewport).
   * @param {string} elementId
   */
  onElementSeen(elementId) {
    if (!this._elements.has(elementId)) {
      this._elements.set(elementId, { seenCount: 1, isVisible: true });
    } else {
      const state = this._elements.get(elementId);
      if (!state.isVisible) {
        state.seenCount++;
        state.isVisible = true;
      }
    }
  }

  /**
   * Mark an element as no longer visible (left viewport).
   * @param {string} elementId
   */
  onElementLeft(elementId) {
    if (this._elements.has(elementId)) {
      this._elements.get(elementId).isVisible = false;
    }
  }

  /**
   * Get total re-read cycles across all tracked elements.
   * A re-read cycle = seenCount - 1 (first time is the initial read).
   */
  getCycles() {
    let total = 0;
    for (const [, state] of this._elements) {
      if (state.seenCount > 1) {
        total += state.seenCount - 1;
      }
    }
    return total;
  }

  /**
   * Get re-read cycles for a specific element.
   * @param {string} elementId
   * @returns {number}
   */
  getCyclesForElement(elementId) {
    const state = this._elements.get(elementId);
    if (!state || state.seenCount <= 1) return 0;
    return state.seenCount - 1;
  }

  /**
   * Check if a specific element has exceeded the re-read threshold.
   * @param {string} elementId
   * @returns {boolean}
   */
  hasExceededThreshold(elementId) {
    return this.getCyclesForElement(elementId) >= this._threshold;
  }

  reset() {
    this._elements.clear();
  }
}
