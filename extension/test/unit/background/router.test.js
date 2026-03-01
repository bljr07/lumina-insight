/**
 * Phase 4 RED Tests — Message Router
 *
 * Tests for the Service Worker's central message routing logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleMessage,
  initRouter,
  setQueuePublisherForRouterTesting,
} from '@background/router.js';
import { MessageType, LearningState } from '@shared/constants.js';

describe('handleMessage()', () => {
  let queuePublisher;

  beforeEach(() => {
    queuePublisher = {
      publish: vi.fn().mockResolvedValue({ published: true, buffered: false }),
      getStatus: vi.fn().mockReturnValue({
        connected: false,
        connecting: false,
        lastError: null,
        bufferedCount: 0,
        lastPublishAt: null,
        lastPublishResult: null,
        retriesInFlight: false,
      }),
      flushBuffer: vi.fn().mockResolvedValue(undefined),
    };
    setQueuePublisherForRouterTesting(queuePublisher);
  });

  it('should store BEHAVIORAL_PACKET to chrome.storage.local', async () => {
    const packet = {
      type: MessageType.BEHAVIORAL_PACKET,
      payload: {
        context: { domain: 'kahoot.it', type: 'QUIZ' },
        metrics: { dwell_time_ms: 5000, scroll_velocity: 0, mouse_jitter: 0.3, tab_switches: 0 },
        inferred_state: LearningState.PENDING_LOCAL_AI,
        timestamp: Date.now(),
      },
    };

    const sendResponse = vi.fn();
    await handleMessage(packet, {}, sendResponse);

    expect(chrome.storage.local.set).toHaveBeenCalled();
    expect(queuePublisher.publish).toHaveBeenCalledTimes(1);
  });

  it('should respond with { received: true } for BEHAVIORAL_PACKET', async () => {
    const packet = {
      type: MessageType.BEHAVIORAL_PACKET,
      payload: {
        context: { domain: 'kahoot.it', type: 'QUIZ' },
        metrics: { dwell_time_ms: 5000, scroll_velocity: 0, mouse_jitter: 0.3, tab_switches: 0 },
        inferred_state: LearningState.PENDING_LOCAL_AI,
        timestamp: Date.now(),
      },
    };

    const sendResponse = vi.fn();
    await handleMessage(packet, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ received: true });
  });

  it('should return current state for GET_STATE message', async () => {
    // First store some state
    await chrome.storage.local.set({
      session: { lastState: LearningState.FOCUSED, packetCount: 3 },
    });

    const message = { type: MessageType.GET_STATE };
    const sendResponse = vi.fn();
    await handleMessage(message, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        lastState: LearningState.FOCUSED,
      })
    );
  });

  it('should handle HEARTBEAT by restoring state', async () => {
    await chrome.storage.local.set({
      session: { lastState: LearningState.STRUGGLING, packetCount: 7 },
    });

    const message = { type: MessageType.HEARTBEAT };
    const sendResponse = vi.fn();
    await handleMessage(message, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        alive: true,
      })
    );
  });

  it('should handle unknown message types gracefully', async () => {
    const message = { type: 'UNKNOWN_TYPE' };
    const sendResponse = vi.fn();

    await handleMessage(message, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(String),
      })
    );
  });

  it('should handle STATE_UPDATED broadcast when sendMessage is not promise-like', async () => {
    chrome.runtime.sendMessage.mockReturnValue(undefined);
    const packet = {
      type: MessageType.BEHAVIORAL_PACKET,
      payload: {
        context: { domain: 'kahoot.it', type: 'QUIZ' },
        metrics: { dwell_time_ms: 5000, scroll_velocity: 0, mouse_jitter: 0.3, tab_switches: 0, re_read_cycles: 0 },
        inferred_state: LearningState.PENDING_LOCAL_AI,
        timestamp: Date.now(),
      },
    };
    const sendResponse = vi.fn();

    await expect(handleMessage(packet, {}, sendResponse)).resolves.toBeUndefined();
    expect(sendResponse).toHaveBeenCalledWith({ received: true });
  });

  it('should return queue status snapshot for QUEUE_STATUS_REQUEST', async () => {
    const sendResponse = vi.fn();
    await handleMessage({ type: MessageType.QUEUE_STATUS_REQUEST }, {}, sendResponse);

    expect(queuePublisher.getStatus).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ connected: false }));
  });

  it('should trigger flush for QUEUE_FLUSH_REQUEST', async () => {
    const sendResponse = vi.fn();
    await handleMessage({ type: MessageType.QUEUE_FLUSH_REQUEST }, {}, sendResponse);

    expect(queuePublisher.flushBuffer).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith({ accepted: true });
  });

  it('should continue returning received:true when queue publish fails', async () => {
    queuePublisher.publish.mockRejectedValue(new Error('queue down'));
    const packet = {
      type: MessageType.BEHAVIORAL_PACKET,
      payload: {
        context: { domain: 'canvas.edu', type: 'LMS_READING' },
        metrics: { dwell_time_ms: 5000, scroll_velocity: 0, mouse_jitter: 0.2, tab_switches: 0, re_read_cycles: 0 },
        inferred_state: LearningState.PENDING_LOCAL_AI,
        timestamp: Date.now(),
      },
    };
    const sendResponse = vi.fn();

    await handleMessage(packet, {}, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ received: true });
  });
});

describe('initRouter()', () => {
  it('should register a message listener', () => {
    initRouter();

    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(expect.any(Function));
  });
});
