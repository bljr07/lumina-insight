/**
 * Phase 3 RED Tests — Platform Detection
 *
 * Tests for URL-based platform classification and
 * DOM-based quiz element detection.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { detectPlatform, detectQuizElements, PLATFORM_REGISTRY } from '@content/platforms.js';
import { PlatformType } from '@shared/constants.js';

// ─── detectPlatform() ──────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  it('should detect Kahoot from URL', () => {
    const result = detectPlatform('https://kahoot.it/challenge/12345');
    expect(result).toEqual({ domain: 'kahoot.it', type: PlatformType.QUIZ });
  });

  it('should detect Kahoot from play subdomain', () => {
    const result = detectPlatform('https://play.kahoot.it/v2/lobby?quizId=abc123');
    expect(result).toEqual({ domain: 'kahoot.it', type: PlatformType.QUIZ });
  });

  it('should detect Canvas LMS', () => {
    const result = detectPlatform('https://canvas.instructure.com/courses/12345/pages/reading');
    expect(result).toEqual({ domain: 'canvas', type: PlatformType.LMS_READING });
  });

  it('should detect Canvas from custom institution domain', () => {
    const result = detectPlatform('https://smu.instructure.com/courses/999/assignments');
    expect(result).toEqual({ domain: 'canvas', type: PlatformType.LMS_READING });
  });

  it('should detect Wooclap', () => {
    const result = detectPlatform('https://app.wooclap.com/events/ABCDEF');
    expect(result).toEqual({ domain: 'wooclap', type: PlatformType.POLL });
  });

  it('should detect Wooclap from alternate URL path', () => {
    const result = detectPlatform('https://www.wooclap.com/ABCDEF');
    expect(result).toEqual({ domain: 'wooclap', type: PlatformType.POLL });
  });

  it('should return UNKNOWN for unrecognized domains', () => {
    const result = detectPlatform('https://www.google.com/search?q=test');
    expect(result).toEqual({ domain: 'google.com', type: PlatformType.UNKNOWN });
  });

  it('should return UNKNOWN for non-learning sites', () => {
    const result = detectPlatform('https://www.youtube.com/watch?v=abc');
    expect(result).toEqual({ domain: 'youtube.com', type: PlatformType.UNKNOWN });
  });

  it('should handle URLs with authentication parameters', () => {
    const result = detectPlatform('https://kahoot.it/challenge/xyz?token=secret');
    expect(result).toEqual({ domain: 'kahoot.it', type: PlatformType.QUIZ });
  });

  it('should be case-insensitive for domains', () => {
    const result = detectPlatform('https://KAHOOT.IT/challenge/123');
    expect(result).toEqual({ domain: 'kahoot.it', type: PlatformType.QUIZ });
  });

  it('should handle invalid URLs gracefully', () => {
    const result = detectPlatform('not a url');
    expect(result).toEqual({ domain: 'unknown', type: PlatformType.UNKNOWN });
  });

  it('should handle empty string', () => {
    const result = detectPlatform('');
    expect(result).toEqual({ domain: 'unknown', type: PlatformType.UNKNOWN });
  });
});

// ─── detectQuizElements() ──────────────────────────────────────────────────────

describe('detectQuizElements()', () => {
  let container;

  beforeEach(() => {
    // Clean up the DOM between tests
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('should find Kahoot answer buttons', () => {
    container.innerHTML = `
      <button class="answer-button">Option A</button>
      <button class="answer-button">Option B</button>
      <button class="answer-button">Option C</button>
      <button class="answer-button">Option D</button>
    `;

    const elements = detectQuizElements(document, 'kahoot.it');
    expect(elements).toHaveLength(4);
  });

  it('should find Wooclap poll options', () => {
    container.innerHTML = `
      <div class="poll-option">Choice 1</div>
      <div class="poll-option">Choice 2</div>
      <div class="poll-option">Choice 3</div>
    `;

    const elements = detectQuizElements(document, 'wooclap');
    expect(elements).toHaveLength(3);
  });

  it('should return empty array for unknown platforms', () => {
    container.innerHTML = '<div>Some content</div>';

    const elements = detectQuizElements(document, 'google.com');
    expect(elements).toEqual([]);
  });

  it('should return empty array when no matching elements exist', () => {
    container.innerHTML = '<div>No quiz elements here</div>';

    const elements = detectQuizElements(document, 'kahoot.it');
    expect(elements).toEqual([]);
  });
});

// ─── PLATFORM_REGISTRY ────────────────────────────────────────────────────────

describe('PLATFORM_REGISTRY', () => {
  it('should be an array of platform definitions', () => {
    expect(Array.isArray(PLATFORM_REGISTRY)).toBe(true);
    expect(PLATFORM_REGISTRY.length).toBeGreaterThan(0);
  });

  it('each entry should have required fields', () => {
    for (const platform of PLATFORM_REGISTRY) {
      expect(platform).toHaveProperty('name');
      expect(platform).toHaveProperty('type');
      expect(platform).toHaveProperty('match');
      expect(typeof platform.match).toBe('function');
    }
  });

  it('should include Kahoot, Canvas, and Wooclap', () => {
    const names = PLATFORM_REGISTRY.map((p) => p.name);
    expect(names).toContain('kahoot.it');
    expect(names).toContain('canvas');
    expect(names).toContain('wooclap');
  });
});
