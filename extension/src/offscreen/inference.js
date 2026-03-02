/**
 * Inference Pipeline - ONNX Runtime Web integration
 *
 * Manages the ONNX model session for on-device AI inference.
 * If ONNX initialization fails, it falls back to rule-based inference.
 */
import * as ort from 'onnxruntime-web';
import { classifyState } from './state-classifier.js';
import { validateMetrics } from '../shared/packet.js';

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

/**
 * Create an inference session.
 *
 * Attempts to initialize a real ONNX Runtime Web session with the local model.
 * If that fails, the returned session still works via rule-based fallback.
 *
 * @returns {Promise<{ run: Function, provider: string, modelSession?: object }>}
 */
export async function createInferenceSession() {
  const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';
  const provider = detectExecutionProvider();
  const modelPath = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
    ? chrome.runtime.getURL('models/student_model_v1.onnx')
    : null;

  if (!isTestEnv && modelPath) {
    try {
      const executionProviders = provider === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'];
      const modelSession = await ort.InferenceSession.create(modelPath, { executionProviders });

      return {
        provider,
        modelSession,
        // Run against ONNX session or fallback to rules if input shape is wrong
        run: async (metrics) => {
          try {
            // Convert metrics to Float32Array matching [1, 5]
            const inputData = Float32Array.from([
              metrics.dwell_time_ms,
              metrics.scroll_velocity,
              metrics.mouse_jitter,
              metrics.tab_switches,
              metrics.re_read_cycles
            ]);
            
            const tensor = new ort.Tensor('float32', inputData, [1, 5]);
            const results = await modelSession.run({ input: tensor });
            const output = results.output.data;
            
            // Map highest output score to LearningState
            const states = ['struggling', 'stalled', 'focused', 'deep-reading', 're-reading', 'idle'];
            let maxIdx = 0;
            for (let i = 1; i < output.length; i++) {
              if (output[i] > output[maxIdx]) maxIdx = i;
            }
            return states[maxIdx] || 'idle';
          } catch (err) {
            console.warn('[Lumina Offscreen] ONNX inference failed, falling back to rules:', err);
            return classifyState(metrics);
          }
        },
      };
    } catch (err) {
      console.warn(
        '[Lumina Offscreen] Failed to initialize ONNX session, falling back to rules:',
        err?.message || err
      );
    }
  }

  return {
    provider: 'wasm',
    run: async (metrics) => classifyState(metrics),
  };
}

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
    console.error('[Lumina Offscreen] Inference failed - invalid metrics:', metrics, err);
    throw err;
  }

  return session.run(metrics);
}
