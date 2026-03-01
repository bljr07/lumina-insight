var LuminaContent = (function (exports) {
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

  /** Platform context types */
  const PlatformType = Object.freeze({
    QUIZ: 'QUIZ',
    POLL: 'POLL',
    LMS_READING: 'LMS_READING',
    UNKNOWN: 'UNKNOWN',
  });

  /** Message types for chrome.runtime.sendMessage routing */
  const MessageType = Object.freeze({
    BEHAVIORAL_PACKET: 'BEHAVIORAL_PACKET',
    INFERENCE_REQUEST: 'INFERENCE_REQUEST',
    INFERENCE_RESULT: 'INFERENCE_RESULT',
    GET_STATE: 'GET_STATE',
    HEARTBEAT: 'HEARTBEAT',
  });

  /** Sensor configuration defaults */
  const SensorConfig = Object.freeze({
    THROTTLE_INTERVAL_MS: 100,
    DWELL_STALL_THRESHOLD_MS: 15000,
    RE_READ_CYCLE_THRESHOLD: 3,
    MOUSE_JITTER_NORMALIZATION_MAX: 500, // pixels
  });

  /**
   * Platform Detection — URL classification & DOM element discovery
   *
   * Identifies which learning platform the student is on and finds
   * platform-specific interactive elements (quiz buttons, poll options, etc.).
   */

  // ─── Platform Registry ─────────────────────────────────────────────────────────

  /**
   * Extensible registry of supported learning platforms.
   * Each entry defines:
   *   - name:     Canonical platform identifier
   *   - type:     PlatformType enum value
   *   - match:    Function(hostname) → boolean
   *   - selectors: CSS selectors for interactive quiz/poll elements
   */
  const PLATFORM_REGISTRY = [
    {
      name: 'kahoot.it',
      type: PlatformType.QUIZ,
      match: (hostname) =>
        hostname === 'kahoot.it' ||
        hostname.endsWith('.kahoot.it'),
      selectors: ['.answer-button', '[data-functional-selector="answer-button"]'],
    },
    {
      name: 'canvas',
      type: PlatformType.LMS_READING,
      match: (hostname) =>
        hostname.endsWith('.instructure.com') ||
        hostname === 'canvas.instructure.com',
      selectors: ['.quiz-question', '.question_text', '.answer'],
    },
    {
      name: 'wooclap',
      type: PlatformType.POLL,
      match: (hostname) =>
        hostname === 'app.wooclap.com' ||
        hostname === 'www.wooclap.com' ||
        hostname === 'wooclap.com',
      selectors: ['.poll-option', '[class*="poll-option"]', '.wc-answer'],
    },
  ];

  // ─── Platform Detection ────────────────────────────────────────────────────────

  /**
   * Detect the learning platform from a URL string.
   *
   * @param {string} urlString - Full URL of the current page
   * @returns {{ domain: string, type: string }} Platform context
   */
  function detectPlatform(urlString) {
    if (!urlString) {
      return { domain: 'unknown', type: PlatformType.UNKNOWN };
    }

    let hostname;
    try {
      const url = new URL(urlString);
      hostname = url.hostname.toLowerCase();
    } catch (err) {
      console.error('[Lumina] Failed to parse URL:', urlString, err);
      return { domain: 'unknown', type: PlatformType.UNKNOWN };
    }

    // Check against the registry
    for (const platform of PLATFORM_REGISTRY) {
      if (platform.match(hostname)) {
        return { domain: platform.name, type: platform.type };
      }
    }

    // Extract base domain for unknown sites
    const parts = hostname.split('.');
    const baseDomain =
      parts.length >= 2 ? `${parts[parts.length - 2]}.${parts[parts.length - 1]}` : hostname;

    return { domain: baseDomain, type: PlatformType.UNKNOWN };
  }

  // ─── Quiz Element Detection ────────────────────────────────────────────────────

  /**
   * Find platform-specific interactive elements in the DOM.
   *
   * @param {Document} doc - The document to search
   * @param {string} platformName - Canonical platform name (e.g., 'kahoot.it')
   * @returns {Element[]} Array of matching DOM elements
   */
  function detectQuizElements(doc, platformName) {
    const platform = PLATFORM_REGISTRY.find((p) => p.name === platformName);

    if (!platform) {
      return [];
    }

    const elementSet = new Set();
    for (const selector of platform.selectors) {
      try {
        const matches = doc.querySelectorAll(selector);
        for (const el of matches) {
          elementSet.add(el);
        }
      } catch (err) {
        console.error('[Lumina] Invalid CSS selector:', selector, err);
      }
    }

    return [...elementSet];
  }

  /**
   * Behavioral Sensors — Interaction Tracking Classes
   *
   * Pure data-tracking classes that monitor learning behavior patterns.
   * No DOM injection — these just accumulate metrics from events.
   */

  // ─── DwellTracker ──────────────────────────────────────────────────────────────

  /**
   * Tracks how long a student dwells on a particular element or page section.
   * Uses Date.now() for timing to work with fake timers in tests.
   */
  class DwellTracker {
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
  class ScrollTracker {
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
  class MouseJitterTracker {
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
  class TabSwitchTracker {
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
  class ReReadDetector {
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

  /**
   * Throttle — Rate-limiting utility for Content Script event emission
   *
   * Ensures at most 1 invocation per interval. Uses a trailing-edge pattern:
   * if calls arrive during the throttle window, the latest args are queued
   * and fired after the interval elapses.
   *
   * @param {Function} fn - Function to throttle
   * @param {number} interval - Minimum ms between invocations
   * @returns {Function} Throttled function (fire-and-forget, returns undefined)
   */
  function throttle(fn, interval) {
    let lastCallTime = 0;
    let trailingTimer = null;
    let trailingArgs = null;

    return function throttled(...args) {
      const now = Date.now();
      const elapsed = now - lastCallTime;

      if (elapsed >= interval) {
        // Enough time has passed — fire immediately
        lastCallTime = now;
        fn(...args);

        // Clear any pending trailing call
        if (trailingTimer !== null) {
          clearTimeout(trailingTimer);
          trailingTimer = null;
          trailingArgs = null;
        }
      } else {
        // Within throttle window — queue trailing call with latest args
        trailingArgs = args;

        if (trailingTimer === null) {
          const remaining = interval - elapsed;
          trailingTimer = setTimeout(() => {
            lastCallTime = Date.now();
            fn(...trailingArgs);
            trailingTimer = null;
            trailingArgs = null;
          }, remaining);
        }
      }
    };
  }

  /**
   * Packet — Behavioral Data Schema & Validation
   *
   * Defines the structured JSON "packet" that Content Scripts emit to the
   * Service Worker. Includes factory, validation, and sanitization functions.
   *
   * Privacy-first: sanitizePacket() strips any fields that could contain PII.
   */

  // ─── Allowed Fields (Allowlist for PII protection) ─────────────────────────────

  const ALLOWED_PACKET_FIELDS = ['context', 'metrics', 'inferred_state', 'timestamp'];
  const ALLOWED_CONTEXT_FIELDS = ['domain', 'type'];
  const ALLOWED_METRICS_FIELDS = ['dwell_time_ms', 'scroll_velocity', 'mouse_jitter', 'tab_switches'];

  // ─── Factory ───────────────────────────────────────────────────────────────────

  /**
   * Creates a validated behavioral packet.
   *
   * @param {{ domain: string, type: string }} context - Platform context
   * @param {{ dwell_time_ms: number, scroll_velocity: number, mouse_jitter: number, tab_switches: number }} metrics
   * @returns {object} A well-formed behavioral packet
   * @throws {Error} If context or metrics are invalid
   */
  function createPacket(context, metrics) {
    if (!context || typeof context !== 'object') {
      console.error('[Lumina] createPacket failed: context is required and must be an object', context);
      throw new Error('context is required and must be an object');
    }
    if (!context.domain) {
      console.error('[Lumina] createPacket failed: context.domain is required', context);
      throw new Error('context.domain is required');
    }
    if (!context.type) {
      console.error('[Lumina] createPacket failed: context.type is required', context);
      throw new Error('context.type is required');
    }
    if (!metrics || typeof metrics !== 'object') {
      console.error('[Lumina] createPacket failed: metrics is required and must be an object', metrics);
      throw new Error('metrics is required and must be an object');
    }

    if (!validateMetrics(metrics)) {
      console.error('[Lumina] createPacket failed: metrics validation failed', metrics);
      throw new Error('metrics failed validation');
    }

    return {
      context: {
        domain: context.domain,
        type: context.type,
      },
      metrics: {
        dwell_time_ms: metrics.dwell_time_ms,
        scroll_velocity: metrics.scroll_velocity,
        mouse_jitter: metrics.mouse_jitter,
        tab_switches: metrics.tab_switches,
      },
      inferred_state: LearningState.PENDING_LOCAL_AI,
      timestamp: Date.now(),
    };
  }

  // ─── Validation ────────────────────────────────────────────────────────────────

  /**
   * Validates a metrics object against the behavioral schema constraints.
   *
   * @param {object} metrics
   * @returns {boolean} true if all metric values are within valid ranges
   */
  function validateMetrics(metrics) {
    if (!metrics || typeof metrics !== 'object') {
      return false;
    }

    // All required fields must be present
    for (const field of ALLOWED_METRICS_FIELDS) {
      if (typeof metrics[field] !== 'number') {
        return false;
      }
    }

    // dwell_time_ms: non-negative
    if (metrics.dwell_time_ms < 0) {
      return false;
    }

    // mouse_jitter: normalized 0–1
    if (metrics.mouse_jitter < 0 || metrics.mouse_jitter > 1.0) {
      return false;
    }

    // tab_switches: non-negative integer
    if (metrics.tab_switches < 0 || !Number.isInteger(metrics.tab_switches)) {
      return false;
    }

    return true;
  }

  // ─── Sanitization (Privacy) ────────────────────────────────────────────────────

  /**
   * Strips any fields not in the allowlist from a packet.
   * Returns a NEW object — does not mutate the input.
   *
   * @param {object} packet - Raw packet that may contain extra fields
   * @returns {object} A sanitized packet containing only allowed fields
   */
  function sanitizePacket(packet) {
    const sanitized = {};

    // Only copy allowed top-level fields
    for (const field of ALLOWED_PACKET_FIELDS) {
      if (field in packet) {
        sanitized[field] = packet[field];
      }
    }

    // Deep-sanitize context
    if (sanitized.context && typeof sanitized.context === 'object') {
      const cleanContext = {};
      for (const field of ALLOWED_CONTEXT_FIELDS) {
        if (field in sanitized.context) {
          cleanContext[field] = sanitized.context[field];
        }
      }
      sanitized.context = cleanContext;
    }

    // Deep-sanitize metrics
    if (sanitized.metrics && typeof sanitized.metrics === 'object') {
      const cleanMetrics = {};
      for (const field of ALLOWED_METRICS_FIELDS) {
        if (field in sanitized.metrics) {
          cleanMetrics[field] = sanitized.metrics[field];
        }
      }
      sanitized.metrics = cleanMetrics;
    }

    return sanitized;
  }

  /**
   * Content Script Main — Wires sensors, platform detection, and packet emission
   *
   * This is the main entry point for the content script. It:
   * 1. Detects the current learning platform
   * 2. Initializes behavioral sensors (dwell, scroll, jitter, tab switch)
   * 3. Emits throttled behavioral packets to the Service Worker
   */

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
      };

      const packet = createPacket(_platform, metrics);
      const sanitized = sanitizePacket(packet);

      chrome.runtime.sendMessage({
        type: MessageType.BEHAVIORAL_PACKET,
        payload: sanitized,
      });
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
  function initContentScript() {
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
    if (quizElements.length > 0) {
      console.debug(`[Lumina] Detected ${quizElements.length} interactive elements on ${_platform.domain}`);
    }

    console.debug(`[Lumina] Content script initialized — platform: ${_platform.domain} (${_platform.type})`);

    return { platform: _platform, sensors: _sensors };
  }

  /**
   * Stop the content script: remove listeners, stop sensors.
   */
  function stopContentScript() {
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

    _platform = null;
    _emitThrottled = null;
  }

  // ─── Auto-initialize when loaded as content script ─────────────────────────────
  const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';
  if (!isTestEnv && typeof window !== 'undefined' && typeof chrome !== 'undefined' && chrome.runtime) {
    initContentScript();
  }

  exports.initContentScript = initContentScript;
  exports.stopContentScript = stopContentScript;

  return exports;

})({});
