/**
 * Phase 5 RED Tests — Inference Pipeline
 *
 * Tests for the ONNX inference pipeline. Since the actual model
 * will be provided by peers, these tests use mocked inference sessions.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createInferenceSession,
  runInference,
  detectExecutionProvider,
} from '@offscreen/inference.js';
import { LearningState } from '@shared/constants.js';

// ─── createInferenceSession() ──────────────────────────────────────────────────

describe('createInferenceSession()', () => {
  it('should return a session object', async () => {
    const session = await createInferenceSession();

    expect(session).toBeDefined();
    expect(session).toHaveProperty('run');
    expect(typeof session.run).toBe('function');
  });
});

// ─── runInference() ────────────────────────────────────────────────────────────

describe('runInference()', () => {
  it('should return a valid learning state', async () => {
    const session = await createInferenceSession();
    const metrics = {
      dwell_time_ms: 12500,
      scroll_velocity: 0,
      mouse_jitter: 0.45,
      tab_switches: 0,
      re_read_cycles: 0,
    };

    const result = await runInference(session, metrics);

    const validStates = Object.values(LearningState);
    expect(validStates).toContain(result);
  });

  it('should throw for invalid input (missing metrics)', async () => {
    const session = await createInferenceSession();

    await expect(runInference(session, null)).rejects.toThrow();
    await expect(runInference(session, {})).rejects.toThrow();
  });

  it('should not make any network calls during inference (UAC 2)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(''))
    );

    const session = await createInferenceSession();
    await runInference(session, {
      dwell_time_ms: 5000,
      scroll_velocity: 100,
      mouse_jitter: 0.2,
      tab_switches: 0,
      re_read_cycles: 0,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

// ─── detectExecutionProvider() ─────────────────────────────────────────────────

describe('detectExecutionProvider()', () => {
  it('should return "wasm" as fallback when WebGPU is unavailable', () => {
    // JSDOM has no navigator.gpu
    const provider = detectExecutionProvider();

    expect(provider).toBe('wasm');
  });

  it('should return "webgpu" when GPU is available', () => {
    // Mock GPU availability
    const originalGpu = navigator.gpu;
    Object.defineProperty(navigator, 'gpu', {
      value: { requestAdapter: vi.fn() },
      configurable: true,
    });

    const provider = detectExecutionProvider();

    expect(provider).toBe('webgpu');

    // Restore
    Object.defineProperty(navigator, 'gpu', {
      value: originalGpu,
      configurable: true,
    });
  });
});
