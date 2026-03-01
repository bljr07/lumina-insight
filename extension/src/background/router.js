/**
 * Message Router — Central message hub for the Service Worker
 *
 * Routes messages from Content Scripts, Popup, and Offscreen Document
 * to the appropriate handlers.
 */
import { MessageType } from '@shared/constants.js';
import { saveSession, loadSession } from './storage.js';
import { classifyState } from '@offscreen/state-classifier.js';

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
        session.latestPacket = message.payload;

        // Run rule-based classification on the metrics
        if (message.payload && message.payload.metrics) {
          try {
            session.lastState = classifyState(message.payload.metrics);
            console.debug('[Lumina SW] Classified state:', session.lastState);
            
            // Broadcast the new state to any open side panels or popups
            chrome.runtime.sendMessage({
              type: MessageType.STATE_UPDATED,
              payload: session.lastState
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
