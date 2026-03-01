/**
 * Phase SP RED Tests — Nudge Mapping Logic
 *
 * Verifies that the mapStateToNudge() function correctly translates
 * raw LearningState enums into user-friendly UI nudges.
 */
import { describe, it, expect } from 'vitest';
import { mapStateToNudge } from '@shared/nudge.js';
import { LearningState } from '@shared/constants.js';

describe('mapStateToNudge()', () => {
  it('should return a struggling nudge', () => {
    const nudge = mapStateToNudge(LearningState.STRUGGLING);
    expect(nudge.type).toBe('struggling');
    expect(nudge.title).toBe('Take a Breath');
    expect(nudge.message).toContain('break this problem down');
  });

  it('should return a stalled (hint) nudge', () => {
    const nudge = mapStateToNudge(LearningState.STALLED);
    expect(nudge.type).toBe('stalled');
    expect(nudge.title).toBe('Need a Hint?');
    expect(nudge.message).toContain('reviewing the previous section');
  });

  it('should return a focused (encouragement) nudge', () => {
    const nudge = mapStateToNudge(LearningState.FOCUSED);
    expect(nudge.type).toBe('focused');
    expect(nudge.title).toBe('On Fire!');
    expect(nudge.message).toContain('Keep up the momentum');
  });

  it('should return a deep reading nudge', () => {
    const nudge = mapStateToNudge(LearningState.DEEP_READING);
    expect(nudge.type).toBe('deep-reading');
    expect(nudge.title).toBe('Deep Focus');
    expect(nudge.message).toContain('reading material');
  });

  it('should return a re-reading nudge', () => {
    const nudge = mapStateToNudge(LearningState.RE_READING);
    expect(nudge.type).toBe('re-reading');
    expect(nudge.title).toBe('Reviewing');
    expect(nudge.message).toContain('Connecting the dots is great');
  });

  it('should return a pending (loading) nudge', () => {
    const nudge = mapStateToNudge(LearningState.PENDING_LOCAL_AI);
    expect(nudge.type).toBe('pending');
    expect(nudge.title).toBe('Analyzing...');
    expect(nudge.message).toContain('gathering insights');
  });

  it('should handle unknown/null states with a default idle nudge', () => {
    const nullNudge = mapStateToNudge(null);
    expect(nullNudge.type).toBe('idle');
    expect(nullNudge.title).toBe('Idle');

    const unknownNudge = mapStateToNudge('SOME_UNKNOWN_STATE');
    expect(unknownNudge.type).toBe('idle');
  });
});
