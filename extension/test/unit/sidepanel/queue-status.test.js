import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_QUEUE_STATUS,
  setupQueueStatusBridge,
  toQueueBadgeLabel,
} from '../../../sidepanel-vue/src/queue-status.js';
import { MessageType } from '@shared/constants.js';

describe('queue-status bridge', () => {
  it('sidepanel requests status on setup', () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    const sendMessage = vi.fn((msg, cb) => cb(DEFAULT_QUEUE_STATUS));
    const onUpdate = vi.fn();

    setupQueueStatusBridge({
      sendMessage,
      onMessage: { addListener, removeListener },
    }, onUpdate);

    expect(sendMessage).toHaveBeenCalledWith(
      { type: MessageType.QUEUE_STATUS_REQUEST },
      expect.any(Function),
    );
    expect(onUpdate).toHaveBeenCalledWith(DEFAULT_QUEUE_STATUS);
  });

  it('updates reactively on QUEUE_STATUS_UPDATED', () => {
    let listener;
    const addListener = vi.fn((cb) => { listener = cb; });
    const sendMessage = vi.fn((msg, cb) => cb(DEFAULT_QUEUE_STATUS));
    const onUpdate = vi.fn();

    setupQueueStatusBridge({
      sendMessage,
      onMessage: { addListener, removeListener: vi.fn() },
    }, onUpdate);

    listener({
      type: MessageType.QUEUE_STATUS_UPDATED,
      payload: { connected: true, bufferedCount: 3 },
    });

    expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      connected: true,
      bufferedCount: 3,
    }));
  });

  it('provides a readable connection badge label', () => {
    expect(toQueueBadgeLabel({ connected: true, connecting: false })).toBe('Connected');
    expect(toQueueBadgeLabel({ connected: false, connecting: true })).toBe('Connecting');
    expect(toQueueBadgeLabel({ connected: false, connecting: false })).toBe('Disconnected');
  });
});
