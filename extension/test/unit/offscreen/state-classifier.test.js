/**
 * Phase 5 RED Tests — State Classifier
 *
 * Tests for the rule-based learning state classifier that maps
 * behavioral metrics to learning states. This runs alongside the
 * ONNX model as a fallback/complement.
 */
import { describe, it, expect } from 'vitest';
import { classifyState, mapStateToNudge } from '@offscreen/state-classifier.js';
import { LearningState, PlatformType } from '@shared/constants.js';

// ─── classifyState() ───────────────────────────────────────────────────────────

describe('classifyState()', () => {
  it('should classify high dwell + high jitter + low scroll as STRUGGLING', () => {
    const metrics = {
      dwell_time_ms: 16000,
      scroll_velocity: 0,
      mouse_jitter: 0.7,
      tab_switches: 0,
    };

    expect(classifyState(metrics)).toBe(LearningState.STRUGGLING);
  });

  it('should classify low dwell + zero jitter as FOCUSED', () => {
    const metrics = {
      dwell_time_ms: 3000,
      scroll_velocity: 50,
      mouse_jitter: 0.05,
      tab_switches: 0,
    };

    expect(classifyState(metrics)).toBe(LearningState.FOCUSED);
  });

  it('should classify high dwell + zero jitter + 0 tab switches as DEEP_READING', () => {
    const metrics = {
      dwell_time_ms: 30000,
      scroll_velocity: 10,
      mouse_jitter: 0.02,
      tab_switches: 0,
    };

    expect(classifyState(metrics)).toBe(LearningState.DEEP_READING);
  });

  it('should classify high dwell + moderate jitter as STALLED', () => {
    const metrics = {
      dwell_time_ms: 20000,
      scroll_velocity: 0,
      mouse_jitter: 0.3,
      tab_switches: 0,
    };

    expect(classifyState(metrics)).toBe(LearningState.STALLED);
  });

  it('should classify high tab_switches as STALLED', () => {
    const metrics = {
      dwell_time_ms: 5000,
      scroll_velocity: 0,
      mouse_jitter: 0.1,
      tab_switches: 5,
    };

    expect(classifyState(metrics)).toBe(LearningState.STALLED);
  });

  it('should handle edge case: all zeros → FOCUSED', () => {
    const metrics = {
      dwell_time_ms: 0,
      scroll_velocity: 0,
      mouse_jitter: 0,
      tab_switches: 0,
    };

    expect(classifyState(metrics)).toBe(LearningState.FOCUSED);
  });
});

// ─── mapStateToNudge() ─────────────────────────────────────────────────────────

describe('mapStateToNudge()', () => {
  it('should return a hint nudge for STRUGGLING + QUIZ context', () => {
    const nudge = mapStateToNudge(LearningState.STRUGGLING, PlatformType.QUIZ);

    expect(nudge).toEqual(
      expect.objectContaining({
        type: 'HINT',
        priority: 'HIGH',
      })
    );
  });

  it('should return a summary nudge for RE_READING + LMS_READING context', () => {
    const nudge = mapStateToNudge(LearningState.RE_READING, PlatformType.LMS_READING);

    expect(nudge).toEqual(
      expect.objectContaining({
        type: 'SUMMARY',
        priority: 'MEDIUM',
      })
    );
  });

  it('should return a logic-bridge nudge for STRUGGLING + POLL context', () => {
    const nudge = mapStateToNudge(LearningState.STRUGGLING, PlatformType.POLL);

    expect(nudge).toEqual(
      expect.objectContaining({
        type: 'LOGIC_BRIDGE',
        priority: 'HIGH',
      })
    );
  });

  it('should return null for FOCUSED state (no nudge needed)', () => {
    const nudge = mapStateToNudge(LearningState.FOCUSED, PlatformType.QUIZ);

    expect(nudge).toBeNull();
  });

  it('should return null for DEEP_READING state (student is engaged)', () => {
    const nudge = mapStateToNudge(LearningState.DEEP_READING, PlatformType.LMS_READING);

    expect(nudge).toBeNull();
  });

  it('should return a break nudge for STALLED state', () => {
    const nudge = mapStateToNudge(LearningState.STALLED, PlatformType.QUIZ);

    expect(nudge).toEqual(
      expect.objectContaining({
        type: 'BREAK',
        priority: 'LOW',
      })
    );
  });
});
