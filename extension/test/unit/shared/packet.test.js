/**
 * Phase 1 RED Tests — Packet Schema & Validation
 *
 * These tests define the contract for the behavioral data packet that
 * Content Scripts emit to the Service Worker. Written BEFORE implementation.
 */
import { describe, it, expect } from 'vitest';
import { LearningState, PlatformType } from '@shared/constants.js';

// Module under test — will be implemented in GREEN phase
import { createPacket, validateMetrics, sanitizePacket } from '@shared/packet.js';

// ─── createPacket() ────────────────────────────────────────────────────────────

describe('createPacket()', () => {
  it('should return a correctly shaped packet with valid inputs', () => {
    const context = { domain: 'kahoot.it', type: PlatformType.QUIZ };
    const metrics = {
      dwell_time_ms: 12500,
      scroll_velocity: 0,
      mouse_jitter: 0.45,
      tab_switches: 0,
    };

    const packet = createPacket(context, metrics);

    expect(packet).toEqual({
      context: { domain: 'kahoot.it', type: 'QUIZ' },
      metrics: {
        dwell_time_ms: 12500,
        scroll_velocity: 0,
        mouse_jitter: 0.45,
        tab_switches: 0,
      },
      inferred_state: LearningState.PENDING_LOCAL_AI,
      timestamp: expect.any(Number),
    });
  });

  it('should throw when domain is missing from context', () => {
    const context = { type: PlatformType.QUIZ }; // no domain
    const metrics = {
      dwell_time_ms: 1000,
      scroll_velocity: 0,
      mouse_jitter: 0,
      tab_switches: 0,
    };

    expect(() => createPacket(context, metrics)).toThrow('domain');
  });

  it('should throw when type is missing from context', () => {
    const context = { domain: 'kahoot.it' }; // no type
    const metrics = {
      dwell_time_ms: 1000,
      scroll_velocity: 0,
      mouse_jitter: 0,
      tab_switches: 0,
    };

    expect(() => createPacket(context, metrics)).toThrow('type');
  });

  it('should default inferred_state to PENDING_LOCAL_AI', () => {
    const context = { domain: 'kahoot.it', type: PlatformType.QUIZ };
    const metrics = {
      dwell_time_ms: 1000,
      scroll_velocity: 0,
      mouse_jitter: 0,
      tab_switches: 0,
    };

    const packet = createPacket(context, metrics);

    expect(packet.inferred_state).toBe(LearningState.PENDING_LOCAL_AI);
  });

  it('should include a numeric timestamp', () => {
    const context = { domain: 'kahoot.it', type: PlatformType.QUIZ };
    const metrics = {
      dwell_time_ms: 1000,
      scroll_velocity: 0,
      mouse_jitter: 0,
      tab_switches: 0,
    };

    const before = Date.now();
    const packet = createPacket(context, metrics);
    const after = Date.now();

    expect(packet.timestamp).toBeGreaterThanOrEqual(before);
    expect(packet.timestamp).toBeLessThanOrEqual(after);
  });

  it('should throw when metrics object is missing', () => {
    const context = { domain: 'kahoot.it', type: PlatformType.QUIZ };

    expect(() => createPacket(context)).toThrow('metrics');
    expect(() => createPacket(context, null)).toThrow('metrics');
  });
});

// ─── validateMetrics() ─────────────────────────────────────────────────────────

describe('validateMetrics()', () => {
  it('should return true for valid metrics', () => {
    const metrics = {
      dwell_time_ms: 5000,
      scroll_velocity: 120.5,
      mouse_jitter: 0.45,
      tab_switches: 2,
    };

    expect(validateMetrics(metrics)).toBe(true);
  });

  it('should return false for negative dwell_time_ms', () => {
    const metrics = {
      dwell_time_ms: -100,
      scroll_velocity: 0,
      mouse_jitter: 0,
      tab_switches: 0,
    };

    expect(validateMetrics(metrics)).toBe(false);
  });

  it('should return false for mouse_jitter > 1.0', () => {
    const metrics = {
      dwell_time_ms: 1000,
      scroll_velocity: 0,
      mouse_jitter: 1.5, // normalized 0-1, this is out of bounds
      tab_switches: 0,
    };

    expect(validateMetrics(metrics)).toBe(false);
  });

  it('should return false for mouse_jitter < 0', () => {
    const metrics = {
      dwell_time_ms: 1000,
      scroll_velocity: 0,
      mouse_jitter: -0.1,
      tab_switches: 0,
    };

    expect(validateMetrics(metrics)).toBe(false);
  });

  it('should return false for negative tab_switches', () => {
    const metrics = {
      dwell_time_ms: 1000,
      scroll_velocity: 0,
      mouse_jitter: 0,
      tab_switches: -1,
    };

    expect(validateMetrics(metrics)).toBe(false);
  });

  it('should return false for non-integer tab_switches', () => {
    const metrics = {
      dwell_time_ms: 1000,
      scroll_velocity: 0,
      mouse_jitter: 0,
      tab_switches: 1.5,
    };

    expect(validateMetrics(metrics)).toBe(false);
  });

  it('should return false when required metric fields are missing', () => {
    expect(validateMetrics({})).toBe(false);
    expect(validateMetrics({ dwell_time_ms: 100 })).toBe(false);
  });

  it('should accept edge case: all zeros', () => {
    const metrics = {
      dwell_time_ms: 0,
      scroll_velocity: 0,
      mouse_jitter: 0,
      tab_switches: 0,
    };

    expect(validateMetrics(metrics)).toBe(true);
  });

  it('should accept edge case: mouse_jitter exactly 1.0', () => {
    const metrics = {
      dwell_time_ms: 1000,
      scroll_velocity: 0,
      mouse_jitter: 1.0,
      tab_switches: 0,
    };

    expect(validateMetrics(metrics)).toBe(true);
  });
});

// ─── sanitizePacket() ──────────────────────────────────────────────────────────

describe('sanitizePacket()', () => {
  it('should strip unexpected fields that could contain PII', () => {
    const packet = {
      context: { domain: 'kahoot.it', type: 'QUIZ' },
      metrics: {
        dwell_time_ms: 5000,
        scroll_velocity: 0,
        mouse_jitter: 0.3,
        tab_switches: 0,
      },
      inferred_state: LearningState.PENDING_LOCAL_AI,
      timestamp: Date.now(),
      // These should be stripped:
      user_name: 'Alice',
      email: 'alice@school.edu',
      raw_text: 'What is the capital of France?',
      dom_content: '<div>secret stuff</div>',
    };

    const sanitized = sanitizePacket(packet);

    expect(sanitized).not.toHaveProperty('user_name');
    expect(sanitized).not.toHaveProperty('email');
    expect(sanitized).not.toHaveProperty('raw_text');
    expect(sanitized).not.toHaveProperty('dom_content');
  });

  it('should preserve only allowed packet fields', () => {
    const packet = {
      context: { domain: 'kahoot.it', type: 'QUIZ' },
      metrics: {
        dwell_time_ms: 5000,
        scroll_velocity: 0,
        mouse_jitter: 0.3,
        tab_switches: 0,
      },
      inferred_state: LearningState.PENDING_LOCAL_AI,
      timestamp: Date.now(),
    };

    const sanitized = sanitizePacket(packet);

    expect(sanitized).toHaveProperty('context');
    expect(sanitized).toHaveProperty('metrics');
    expect(sanitized).toHaveProperty('inferred_state');
    expect(sanitized).toHaveProperty('timestamp');
    expect(Object.keys(sanitized)).toHaveLength(4);
  });

  it('should strip unexpected fields from context', () => {
    const packet = {
      context: {
        domain: 'kahoot.it',
        type: 'QUIZ',
        url: 'https://kahoot.it/challenge/12345?user=alice', // PII in URL
      },
      metrics: {
        dwell_time_ms: 5000,
        scroll_velocity: 0,
        mouse_jitter: 0.3,
        tab_switches: 0,
      },
      inferred_state: LearningState.PENDING_LOCAL_AI,
      timestamp: Date.now(),
    };

    const sanitized = sanitizePacket(packet);

    expect(sanitized.context).not.toHaveProperty('url');
    expect(sanitized.context).toEqual({ domain: 'kahoot.it', type: 'QUIZ' });
  });

  it('should strip unexpected fields from metrics', () => {
    const packet = {
      context: { domain: 'kahoot.it', type: 'QUIZ' },
      metrics: {
        dwell_time_ms: 5000,
        scroll_velocity: 0,
        mouse_jitter: 0.3,
        tab_switches: 0,
        keystrokes: 42, // Not part of schema — potential PII signal
      },
      inferred_state: LearningState.PENDING_LOCAL_AI,
      timestamp: Date.now(),
    };

    const sanitized = sanitizePacket(packet);

    expect(sanitized.metrics).not.toHaveProperty('keystrokes');
    expect(Object.keys(sanitized.metrics)).toHaveLength(4);
  });

  it('should return a new object (not mutate the input)', () => {
    const packet = {
      context: { domain: 'kahoot.it', type: 'QUIZ' },
      metrics: {
        dwell_time_ms: 5000,
        scroll_velocity: 0,
        mouse_jitter: 0.3,
        tab_switches: 0,
      },
      inferred_state: LearningState.PENDING_LOCAL_AI,
      timestamp: Date.now(),
      secret: 'should-be-stripped',
    };

    const sanitized = sanitizePacket(packet);

    expect(sanitized).not.toBe(packet);
    expect(packet).toHaveProperty('secret'); // Original unchanged
  });
});
