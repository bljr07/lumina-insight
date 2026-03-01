/**
 * Phase 2 RED Tests — Behavioral Sensors
 *
 * Tests for DwellTracker, ScrollTracker, MouseJitterTracker,
 * TabSwitchTracker, and ReReadDetector.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DwellTracker,
  ScrollTracker,
  MouseJitterTracker,
  TabSwitchTracker,
  ReReadDetector,
} from '@content/sensors.js';

// ─── DwellTracker ──────────────────────────────────────────────────────────────

describe('DwellTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return 0 before start is called', () => {
    const tracker = new DwellTracker();
    expect(tracker.get()).toBe(0);
  });

  it('should track elapsed time after start()', () => {
    const tracker = new DwellTracker();

    tracker.start();
    vi.advanceTimersByTime(500);

    const elapsed = tracker.get();
    expect(elapsed).toBeGreaterThanOrEqual(500);
    expect(elapsed).toBeLessThanOrEqual(550);
  });

  it('should stop tracking after stop()', () => {
    const tracker = new DwellTracker();

    tracker.start();
    vi.advanceTimersByTime(300);
    tracker.stop();
    vi.advanceTimersByTime(300);

    const elapsed = tracker.get();
    expect(elapsed).toBeGreaterThanOrEqual(300);
    expect(elapsed).toBeLessThanOrEqual(350);
  });

  it('should reset to 0 after reset()', () => {
    const tracker = new DwellTracker();

    tracker.start();
    vi.advanceTimersByTime(1000);
    tracker.reset();

    expect(tracker.get()).toBe(0);
  });

  it('should allow restart after stop()', () => {
    const tracker = new DwellTracker();

    tracker.start();
    vi.advanceTimersByTime(200);
    tracker.stop();
    tracker.start();
    vi.advanceTimersByTime(300);

    const elapsed = tracker.get();
    // Should be ~500ms total (200 + 300)
    expect(elapsed).toBeGreaterThanOrEqual(500);
    expect(elapsed).toBeLessThanOrEqual(550);
  });
});

// ─── ScrollTracker ─────────────────────────────────────────────────────────────

describe('ScrollTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return 0 velocity before any scroll events', () => {
    const tracker = new ScrollTracker();
    expect(tracker.getVelocity()).toBe(0);
  });

  it('should calculate scroll velocity in pixels/second', () => {
    const tracker = new ScrollTracker();

    // Simulate scrolling 500px in 1 second
    tracker.onScroll(0);
    vi.advanceTimersByTime(1000);
    tracker.onScroll(500);

    const velocity = tracker.getVelocity();
    expect(velocity).toBeCloseTo(500, 0); // ~500 px/s
  });

  it('should handle negative scroll (scrolling up)', () => {
    const tracker = new ScrollTracker();

    tracker.onScroll(500);
    vi.advanceTimersByTime(1000);
    tracker.onScroll(0);

    const velocity = tracker.getVelocity();
    // Velocity should use absolute value
    expect(velocity).toBeCloseTo(500, 0);
  });

  it('should return 0 when no time has elapsed', () => {
    const tracker = new ScrollTracker();

    tracker.onScroll(0);
    tracker.onScroll(100); // same timestamp

    expect(tracker.getVelocity()).toBe(0);
  });

  it('should reset state', () => {
    const tracker = new ScrollTracker();

    tracker.onScroll(0);
    vi.advanceTimersByTime(1000);
    tracker.onScroll(500);
    tracker.reset();

    expect(tracker.getVelocity()).toBe(0);
  });
});

// ─── MouseJitterTracker ────────────────────────────────────────────────────────

describe('MouseJitterTracker', () => {
  it('should return 0 before any mouse events', () => {
    const tracker = new MouseJitterTracker();
    expect(tracker.getJitter()).toBe(0);
  });

  it('should calculate normalized jitter from mouse movements', () => {
    const tracker = new MouseJitterTracker();

    // Simulate jittery mouse: small random movements
    const movements = [
      { x: 100, y: 100 },
      { x: 103, y: 98 },
      { x: 97, y: 102 },
      { x: 104, y: 96 },
      { x: 99, y: 101 },
    ];

    for (const move of movements) {
      tracker.onMove(move.x, move.y);
    }

    const jitter = tracker.getJitter();
    expect(jitter).toBeGreaterThan(0);
    expect(jitter).toBeLessThanOrEqual(1.0);
  });

  it('should return 0 for perfectly still mouse', () => {
    const tracker = new MouseJitterTracker();

    // Same position repeated
    for (let i = 0; i < 5; i++) {
      tracker.onMove(100, 100);
    }

    expect(tracker.getJitter()).toBe(0);
  });

  it('should clamp jitter to 1.0 for extreme movements', () => {
    const tracker = new MouseJitterTracker();

    // Very extreme jitter that exceeds normalization max
    const movements = [
      { x: 0, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: 0 },
      { x: 1000, y: 1000 },
    ];

    for (const move of movements) {
      tracker.onMove(move.x, move.y);
    }

    expect(tracker.getJitter()).toBe(1.0);
  });

  it('should reset state', () => {
    const tracker = new MouseJitterTracker();

    tracker.onMove(0, 0);
    tracker.onMove(100, 100);
    tracker.reset();

    expect(tracker.getJitter()).toBe(0);
  });
});

// ─── TabSwitchTracker ──────────────────────────────────────────────────────────

describe('TabSwitchTracker', () => {
  it('should return 0 before any visibility changes', () => {
    const tracker = new TabSwitchTracker();
    expect(tracker.getCount()).toBe(0);
  });

  it('should increment on hidden→visible transition', () => {
    const tracker = new TabSwitchTracker();

    tracker.onVisibilityChange(true);  // hidden
    tracker.onVisibilityChange(false); // visible again

    expect(tracker.getCount()).toBe(1);
  });

  it('should count multiple tab switches', () => {
    const tracker = new TabSwitchTracker();

    // 3 complete away-and-back cycles
    for (let i = 0; i < 3; i++) {
      tracker.onVisibilityChange(true);  // hidden
      tracker.onVisibilityChange(false); // visible
    }

    expect(tracker.getCount()).toBe(3);
  });

  it('should not count consecutive hidden events', () => {
    const tracker = new TabSwitchTracker();

    tracker.onVisibilityChange(true);  // hidden
    tracker.onVisibilityChange(true);  // still hidden (no double-count)
    tracker.onVisibilityChange(false); // visible

    expect(tracker.getCount()).toBe(1);
  });

  it('should reset count', () => {
    const tracker = new TabSwitchTracker();

    tracker.onVisibilityChange(true);
    tracker.onVisibilityChange(false);
    tracker.reset();

    expect(tracker.getCount()).toBe(0);
  });
});

// ─── ReReadDetector ────────────────────────────────────────────────────────────

describe('ReReadDetector', () => {
  it('should return 0 re-read cycles initially', () => {
    const detector = new ReReadDetector();
    expect(detector.getCycles()).toBe(0);
  });

  it('should detect a re-read cycle (scroll up past previously seen element)', () => {
    const detector = new ReReadDetector();

    // Simulate: see element A → scroll past → scroll back to A
    detector.onElementSeen('element-A');
    detector.onElementLeft('element-A');
    detector.onElementSeen('element-A'); // re-read!

    expect(detector.getCycles()).toBe(1);
  });

  it('should count multiple re-read cycles', () => {
    const detector = new ReReadDetector();

    for (let i = 0; i < 3; i++) {
      detector.onElementSeen('element-A');
      detector.onElementLeft('element-A');
    }
    detector.onElementSeen('element-A'); // 3 cycles means seen 4 times

    expect(detector.getCycles()).toBeGreaterThanOrEqual(3);
  });

  it('should track re-reads per element independently', () => {
    const detector = new ReReadDetector();

    // Element A: 1 re-read
    detector.onElementSeen('element-A');
    detector.onElementLeft('element-A');
    detector.onElementSeen('element-A');

    // Element B: no re-read
    detector.onElementSeen('element-B');

    expect(detector.getCyclesForElement('element-A')).toBe(1);
    expect(detector.getCyclesForElement('element-B')).toBe(0);
  });

  it('should report hasExceededThreshold when cycles >= threshold', () => {
    const detector = new ReReadDetector(3); // threshold = 3

    // 3 cycles
    for (let i = 0; i < 3; i++) {
      detector.onElementSeen('paragraph-1');
      detector.onElementLeft('paragraph-1');
    }
    detector.onElementSeen('paragraph-1');

    expect(detector.hasExceededThreshold('paragraph-1')).toBe(true);
  });

  it('should not report threshold exceeded when below', () => {
    const detector = new ReReadDetector(3);

    detector.onElementSeen('paragraph-1');
    detector.onElementLeft('paragraph-1');
    detector.onElementSeen('paragraph-1');

    expect(detector.hasExceededThreshold('paragraph-1')).toBe(false);
  });

  it('should reset state', () => {
    const detector = new ReReadDetector();

    detector.onElementSeen('element-A');
    detector.onElementLeft('element-A');
    detector.onElementSeen('element-A');
    detector.reset();

    expect(detector.getCycles()).toBe(0);
  });
});
