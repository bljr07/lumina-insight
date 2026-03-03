/**
 * Inference Pipeline - ONNX Runtime Web integration
 *
 * Manages the ONNX model session for on-device AI inference.
 * If ONNX initialization fails, it falls back to rule-based inference.
 */
import * as ort from 'onnxruntime-web';
import { classifyState } from './state-classifier.js';
import { validateMetrics } from '../shared/packet.js';

// Temporal buffer
const BUFFER_SIZE = 20;
let metricsBuffer = [];

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
            // Buffer new metrics
            metricsBuffer.push(metrics);
            if (metricsBuffer.length > BUFFER_SIZE) {
              metricsBuffer.shift();
            }

            // Fallback to rules if buffer is not full enough (can reduce if needed, but waiting is safer)
            if (metricsBuffer.length < 5) { // Need at least 5 frames for variance/slope safely
              return classifyState(metrics);
            }

            // Compute temporal features
            // 1. Mean Dwell
            const meanDwell = metricsBuffer.reduce((sum, m) => sum + m.dwell_time_ms, 0) / metricsBuffer.length;

            // 2. Dwell Slope (simple difference over time)
            const dwellSlope = (metricsBuffer[metricsBuffer.length - 1].dwell_time_ms - metricsBuffer[0].dwell_time_ms) / metricsBuffer.length;

            // 3. Jitter Variance
            const meanJitter = metricsBuffer.reduce((sum, m) => sum + m.mouse_jitter, 0) / metricsBuffer.length;
            const jitterVariance = metricsBuffer.reduce((sum, m) => sum + Math.pow(m.mouse_jitter - meanJitter, 2), 0) / metricsBuffer.length;

            // 4. Tab Switch Rate
            const totalSwitches = metricsBuffer.reduce((sum, m) => sum + m.tab_switches, 0);
            const tabSwitchRate = totalSwitches / metricsBuffer.length;

            // 5. Reread Trend (difference in reread cycles)
            const rereadStart = metricsBuffer[0].re_read_cycles || 0;
            const rereadEnd = metricsBuffer[metricsBuffer.length - 1].re_read_cycles || 0;
            const rereadTrend = (rereadEnd - rereadStart) / metricsBuffer.length;

            const inputData = Float32Array.from([
              meanDwell,
              dwellSlope,
              jitterVariance,
              tabSwitchRate,
              rereadTrend
            ]);

            const tensor = new ort.Tensor('float32', inputData, [1, 5]);
            const results = await modelSession.run({ input: tensor });
            const output = results.output.data;

            // Map highest output score to LearningState
            const states = ['struggling', 'stalled', 'focused', 'deep-reading', 're-reading', 'idle'];
            let maxIdx = 0;
            let maxVal = -Infinity;
            // Softmax conversion for confidence gating
            const exps = [];
            let sumExps = 0;
            for (let i = 0; i < output.length; i++) {
              exps[i] = Math.exp(output[i]);
              sumExps += exps[i];
              if (output[i] > maxVal) {
                maxVal = output[i];
                maxIdx = i;
              }
            }
            const probs = exps.map(e => e / sumExps);
            const confidence = probs[maxIdx];

            // Confidence gating: if confidence < 0.6, fallback to rule-based
            if (confidence < 0.6) {
              return classifyState(metrics);
            }

            // Adjust index mappings if the original model trained differently, 
            // assuming states matches original output logits structure.
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
