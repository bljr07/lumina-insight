import { MessageType } from '../../src/shared/constants.js';

export const DEFAULT_QUEUE_STATUS = Object.freeze({
  connected: false,
  connecting: false,
  lastError: null,
  bufferedCount: 0,
  lastPublishAt: null,
  lastPublishResult: null,
  retriesInFlight: false,
});

export function toQueueBadgeLabel(status) {
  if (status.connecting) {
    return 'Connecting';
  }
  return status.connected ? 'Connected' : 'Disconnected';
}

export function setupQueueStatusBridge(runtime, onUpdate) {
  if (!runtime || typeof onUpdate !== 'function') {
    return () => {};
  }

  const listener = (message) => {
    if (message?.type === MessageType.QUEUE_STATUS_UPDATED && message.payload) {
      onUpdate({ ...DEFAULT_QUEUE_STATUS, ...message.payload });
    }
  };

  runtime.onMessage.addListener(listener);

  runtime.sendMessage({ type: MessageType.QUEUE_STATUS_REQUEST }, (response) => {
    if (runtime.lastError || !response) {
      return;
    }
    onUpdate({ ...DEFAULT_QUEUE_STATUS, ...response });
  });

  return () => {
    runtime.onMessage.removeListener(listener);
  };
}
