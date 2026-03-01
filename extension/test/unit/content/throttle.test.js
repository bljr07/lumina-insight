/**
 * Phase 2 RED Tests — Throttle Utility
 *
 * Tests for the throttle function that limits Content Script
 * event emission to max 1 sample per interval (default: 100ms).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { throttle } from '@content/throttle.js';

describe('throttle()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should invoke the function immediately on first call', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled('arg1');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('arg1');
  });

  it('should suppress calls within the throttle interval', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled(); // fires immediately
    throttled(); // should be suppressed (within 100ms)
    throttled(); // should be suppressed

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should allow a call after the interval has elapsed', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled(); // fires immediately
    vi.advanceTimersByTime(150);
    throttled(); // should fire (150ms > 100ms)

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should fire trailing call with latest args after interval', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled('first');   // fires immediately with 'first'
    throttled('second');  // queued
    throttled('third');   // replaces queued (latest args)

    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('third');
  });

  it('should not invoke after the interval if no trailing calls were made', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    vi.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should handle rapid bursts correctly', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    // Simulate 10 calls in 50ms
    for (let i = 0; i < 10; i++) {
      throttled(i);
      vi.advanceTimersByTime(5);
    }

    // At 50ms: only the first call should have fired
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(0);

    // Advance past the throttle interval — trailing should fire
    vi.advanceTimersByTime(100);

    // 1 immediate + 1 trailing = 2
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(9); // latest args
  });

  it('should support custom intervals', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 500);

    throttled();
    vi.advanceTimersByTime(200);
    throttled(); // Should be suppressed (200ms < 500ms)

    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(300); // Now at 500ms total
    throttled();

    // 1 immediate + 1 trailing (from 200ms call)  = 2, then the 500ms call may queue
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should return undefined (fire-and-forget)', () => {
    const fn = vi.fn(() => 42);
    const throttled = throttle(fn, 100);

    const result = throttled();

    expect(result).toBeUndefined();
  });
});
