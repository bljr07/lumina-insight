import { createInferenceSession, runInference } from './inference.js';
import { mapStateToNudgeAsync } from './state-classifier.js';

let session = null;

// Initialize the inference session on load
async function init() {
  try {
    session = await createInferenceSession();
    console.log('[Offscreen] Inference session ready, provider:', session.provider);
  } catch (err) {
    console.error('[Offscreen] Failed to create inference session:', err);
  }
}

// Listen for inference requests from the Service Worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    const { state, platform, transient_content } = message.payload;
    mapStateToNudgeAsync(state, platform, transient_content)
      .then((nudge) => {
        sendResponse({ nudge });
      })
      .catch((err) => {
        console.error('[Offscreen] Generation failed:', err);
        sendResponse({ error: err.message });
      });
    return true;
  }
});

init();
