import { createInferenceSession, runInference } from './inference.js';
import { mapStateToNudgeAsync } from './state-classifier.js';

let session = null;

// Initialize the inference session on load — NON-FATAL so the message listener stays alive
async function init() {
  try {
    session = await createInferenceSession();
    console.log('[Offscreen] Inference session ready, provider:', session.provider);
  } catch (err) {
    // ONNX init can fail (missing model, WASM error) — that's fine,
    // the document must stay alive for GENERATE_NUDGE / LLM calls.
    console.warn('[Offscreen] ONNX session not available (non-fatal):', err.message);
  }
}

// Listen for messages from the Service Worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Offscreen] Received message:', message.type);

  if (message.type === 'INFERENCE_REQUEST') {
    if (!session) {
      sendResponse({ error: 'Session not initialized' });
      return true;
    }

    runInference(session, message.payload.metrics)
      .then((state) => {
        sendResponse({ state });
      })
      .catch((err) => {
        sendResponse({ error: err.message });
      });

    return true; // keep channel open for async response

  } else if (message.type === 'GENERATE_NUDGE') {
    console.log('[Offscreen] 🧠 Processing GENERATE_NUDGE:', {
      state: message.payload.state,
      platform: message.payload.platform,
      hasContent: !!message.payload.transient_content,
    });

    const { state, platform, transient_content } = message.payload;
    mapStateToNudgeAsync(state, platform, transient_content)
      .then((nudge) => {
        console.log('[Offscreen] ✅ Nudge generated:', nudge);
        sendResponse({ nudge });
      })
      .catch((err) => {
        console.error('[Offscreen] ❌ Generation failed:', err);
        sendResponse({ error: err.message });
      });

    return true; // keep channel open for async response
  }

  // Unhandled message types — don't call sendResponse
  return false;
});

init();
