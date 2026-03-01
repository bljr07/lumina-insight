/**
 * Inference Pipeline — ONNX Runtime Web integration
 *
 * Manages the ONNX model session for on-device AI inference.
 * Currently uses a stub session that delegates to the rule-based
 * classifier. Will be replaced with a real ONNX model from peers.
 *
 * Architecture:
 *   1. detectExecutionProvider() → 'webgpu' | 'wasm'
 *   2. createInferenceSession() → session object
 *   3. runInference(session, metrics) → LearningState
 */
import { classifyState } from './state-classifier.js';
import { validateMetrics } from '../shared/packet.js';

// ─── Execution Provider Detection (UAC 4: Graceful Degradation) ────────────────

/**
 * Detect the best available execution provider.
 * Prefers WebGPU, falls back to WebAssembly.
 *
 * @returns {'webgpu' | 'wasm'}
 */
export function detectExecutionProvider() {
  if (typeof navigator !== 'undefined' && navigator.gpu) {
    return 'webgpu';
  }
  return 'wasm';
}

// ─── Inference Session ─────────────────────────────────────────────────────────

/**
 * Create an inference session.
 *
 * Currently returns a stub session that uses the rule-based classifier.
 * When the real ONNX model is provided by peers, this will load the
 * model file and create an ONNX Runtime Web InferenceSession.
 *
 * @returns {Promise<{ run: Function, provider: string }>}
 */
export async function createInferenceSession() {
  const provider = detectExecutionProvider();

  // Stub session — delegates to rule-based classifier
  // TODO: Replace with real ONNX Runtime Web session:
  //   const session = await ort.InferenceSession.create(modelPath, {
  //     executionProviders: [provider],
  //   });
  return {
    provider,
    run: async (metrics) => {
      return classifyState(metrics);
    },
  };
}

// ─── Inference Execution ───────────────────────────────────────────────────────

/**
 * Run inference on behavioral metrics.
 *
 * @param {{ run: Function }} session - Inference session from createInferenceSession
 * @param {object} metrics - Behavioral metrics from the content script
 * @returns {Promise<string>} Inferred learning state
 * @throws {Error} If metrics are invalid
 */
export async function runInference(session, metrics) {
  if (!metrics || typeof metrics !== 'object' || !validateMetrics(metrics)) {
    const err = new Error('Invalid metrics: must contain dwell_time_ms, scroll_velocity, mouse_jitter, tab_switches, re_read_cycles');
    console.error('[Lumina Offscreen] Inference failed — invalid metrics:', metrics, err);
    throw err;
  }

  // All inference happens locally — no network calls (UAC 2)
  return session.run(metrics);
}
