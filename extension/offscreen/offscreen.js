/**
 * Lumina Insight — Offscreen AI Engine
 * 
 * Runs the ONNX Runtime Web locally using WebAssembly. Listens for incoming 
 * requests from the Service Worker, formats the raw behavioral metrics into 
 * ONNX Tensors, and performs an inference pass to deduce the Learning State.
 */

// We maintain a persistent session while the doc is alive to save initialization time
let _inferenceSession = null;

// The possible states returned by the neural network
const LEARNING_STATES = [
    'FOCUSED',
    'STALLED',
    'STRUGGLING',
    'DEEP_READING',
    'RE_READING'
];

/**
 * Initializes the ONNX Runtime Web session from a local `.onnx` file.
 * Returns the session if it's already active.
 */
async function initializeONNXSession() {
    if (_inferenceSession) return _inferenceSession;

    try {
        console.debug('[Lumina AI] Formatting ONNX Execution Provider (WASM)...');
        // Normally this points to a real local path: e.g. `await ort.InferenceSession.create('/models/student_model_v1.onnx')`
        // For Phase 2 sandbox, we will simulate the connection unless the file is present.

        // _inferenceSession = await ort.InferenceSession.create('/models/student_model_v1.onnx');
        console.debug('[Lumina AI] Session ready.');
        return true;
    } catch (err) {
        console.error('[Lumina AI] ONNX Initialization Failed:', err);
        return null;
    }
}

/**
 * Converts the raw JSON metrics object into a Float32 ONNX Tensor.
 */
function metricsToTensor(metrics) {
    // Neural nets require normalized Float arrays [dwell, scroll, jitter, tab_switches]
    const inputArray = new Float32Array([
        metrics.dwell_time_ms / 15000.0, // Normalize against typical max
        metrics.scroll_velocity / 1000.0,
        metrics.mouse_jitter,
        metrics.tab_switches / 5.0
    ]);

    // Create tensor of shape [1, 4] for batch size 1, 4 features
    const tensor = new ort.Tensor('float32', inputArray, [1, 4]);
    return tensor;
}

/**
 * The core Inference function. Executes the ONNX graph against the tensor.
 */
async function runInference(metrics) {
    try {
        await initializeONNXSession();

        // Mocking the ONNX tensor output for the Phase 2 MVP structure
        // Since we don't have a physical .onnx file provided in the codebase yet.
        console.debug('[Lumina AI] Running inference for metrics:', metrics);

        let predictedState = 'FOCUSED';

        // Basic fallback heuristic to simulate the tensor math output
        if (metrics.dwell_time_ms > 10000 && metrics.mouse_jitter > 0.4) {
            predictedState = 'STRUGGLING';
        } else if (metrics.tab_switches > 2) {
            predictedState = 'STALLED';
        } else if (metrics.dwell_time_ms > 5000 && metrics.mouse_jitter < 0.1) {
            predictedState = 'DEEP_READING';
        }

        console.debug(`[Lumina AI] Inference Complete -> ${predictedState}`);
        return predictedState;

        /* REAL IMPLEMENTATION (when model is loaded):
        const inputTensor = metricsToTensor(metrics);
        const feeds = { input: inputTensor };
        const results = await _inferenceSession.run(feeds);
        
        // The result is usually a probability array (e.g. argmax)
        const outputData = results.output.data;
        const maxIndex = outputData.indexOf(Math.max(...outputData));
        return LEARNING_STATES[maxIndex];
        */

    } catch (err) {
        console.error('[Lumina AI] Inference execution failed:', err);
        return 'UNKNOWN';
    }
}

// ─── Message Listener ───────────────────────────────────────────────────

/**
 * Listen for `INFERENCE_REQUEST` messages from the `service-worker.js`.
 * We must execute asynchronously and return the string state.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'INFERENCE_REQUEST') {
        const payload = message.payload;

        // Prevent blocking the listener via an async wrapper
        (async () => {
            const inferredState = await runInference(payload.metrics);

            // Reply directly to the service worker with the result
            sendResponse({ state: inferredState });
        })();

        return true; // Keeps the sendResponse channel alive asynchronously
    }
});
