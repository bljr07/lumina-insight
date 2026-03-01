/**
 * Message Router — Central message hub for the Service Worker
 *
 * Routes messages from Content Scripts, Popup, and Offscreen Document
 * to the appropriate handlers.
 */
import { MessageType } from '@shared/constants.js';
import { saveSession, loadSession } from './storage.js';
import { classifyState } from '@offscreen/state-classifier.js';
import { sanitizePacket } from '@shared/packet.js';
import { ensureOffscreen } from './offscreen-manager.js';

/**
 * Handle an incoming runtime message.
 *
 * @param {object} message - The message object with { type, payload }
 * @param {object} sender - chrome.runtime.MessageSender
 * @param {Function} sendResponse - callback to send a response
 */
export async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case MessageType.BEHAVIORAL_PACKET: {
        // Store the latest packet, classify state, and increment count
        const session = await loadSession();
        session.packetCount = (session.packetCount || 0) + 1;
        // Strip transient_content and PII before hitting storage constraints (UAC 1)
        session.latestPacket = sanitizePacket(message.payload);

        // Run rule-based classification on the metrics
        if (message.payload && message.payload.metrics) {
          try {
            let nextState = classifyState(message.payload.metrics);

            // Phase 2: Attempt to utilize the Offscreen ONNX AI Engine
            try {
              await ensureOffscreen();
              const aiResult = await chrome.runtime.sendMessage({
                type: MessageType.INFERENCE_REQUEST,
                payload: message.payload
              });

              if (aiResult && aiResult.state && aiResult.state !== 'UNKNOWN') {
                nextState = aiResult.state;
                console.debug('[Lumina SW] State classified via ONNX Engine:', nextState);
              } else {
                console.debug('[Lumina SW] State classified via Rule Fallback:', nextState);
              }
            } catch (onnxErr) {
              // If offscreen doesn't respond, we fall back to the rule-based engine silently
              console.debug('[Lumina SW] State classified via Rule Fallback (ONNX failed or loading):', nextState);
            }

            session.lastState = nextState;
            const currentContent = message.payload.transient_content || null;
            
            const stateChanged = session.lastState !== session.lastPromptedState;
            const contentChanged = currentContent !== session.lastPromptedContent;

            if (stateChanged || contentChanged) {
              // Ask Offscreen Document to run LLM logic
              console.log(`[Lumina SW] 📤 Requesting Generative Nudge for state: ${session.lastState}`);
              console.log(`[Lumina SW] 📎 Transient content extracted: "${currentContent || 'None'}"`);
              await ensureOffscreen();
              const generateResponse = await chrome.runtime.sendMessage({
                type: MessageType.GENERATE_NUDGE,
                payload: {
                  state: session.lastState,
                  platform: message.payload.context.type,
                  transient_content: currentContent
                }
              }).catch(() => null);

              if (generateResponse && generateResponse.nudge) {
                session.lastNudge = generateResponse.nudge;
              } else {
                session.lastNudge = null;
              }

              // Update cache to prevent redundant LLM calls
              session.lastPromptedState = session.lastState;
              session.lastPromptedContent = currentContent;
            } else {
              console.debug(`[Lumina SW] ♻️ Reusing cached nudge for state: ${session.lastState} (No change in state or content)`);
            }
            
            // Broadcast the new state to any open side panels or popups
            chrome.runtime.sendMessage({
              type: MessageType.STATE_UPDATED,
              payload: { state: session.lastState, nudge: session.lastNudge }
            }).catch(() => {
              // Ignore errors (happens if no popup/panel is open to receive it)
            });
            
          } catch (err) {
            console.error('[Lumina SW] Classification failed:', err);
          }
        }

        await saveSession(session);

        sendResponse({ received: true });
        break;
      }

      case MessageType.GET_STATE: {
        const session = await loadSession();
        sendResponse(session);
        break;
      }

      case MessageType.HEARTBEAT: {
        // Re-hydrate state from storage (Service Worker may have been idle)
        const session = await loadSession();
        sendResponse({ alive: true, session });
        break;
      }

      default: {
        console.error('[Lumina SW] Unknown message type:', message.type);
        sendResponse({ error: `Unknown message type: ${message.type}` });
        break;
      }
    }
  } catch (err) {
    console.error('[Lumina SW] Error handling message:', message.type, err);
    sendResponse({ error: err.message });
  }
}

/**
 * Initialize the message router by registering the onMessage listener.
 */
export function initRouter() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // handleMessage is async, so we need to return true to keep the
    // sendResponse channel open
    handleMessage(message, sender, sendResponse);
    return true;
  });
}
