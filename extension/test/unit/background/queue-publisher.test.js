import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  QueuePublisher,
  BUFFER_PACKETS_KEY,
  createQueueConfig,
} from '@background/queue-publisher.js';
import { MessageType } from '@shared/constants.js';

function makeConfig(overrides = {}) {
  return {
    wsUrl: 'wss://rabbitmq.example/ws',
    login: 'guest',
    passcode: 'guest',
    exchange: 'lumina.events',
    routingKey: 'behavior.packet',
    ...overrides,
  };
}

describe('QueuePublisher', () => {
  let publisher;
  let mockClient;
  let clientFactory;

  beforeEach(() => {
    vi.useFakeTimers();

    mockClient = {
      activate: vi.fn(),
      deactivate: vi.fn(),
      publish: vi.fn(),
    };

    clientFactory = vi.fn(() => mockClient);
  });

  afterEach(() => {
    publisher?.destroy?.();
    vi.useRealTimers();
  });

  it('connects using Web-STOMP over configured WSS endpoint', async () => {
    publisher = new QueuePublisher({ config: makeConfig(), clientFactory });
    await publisher.init();

    expect(clientFactory).toHaveBeenCalledWith(expect.objectContaining({
      brokerURL: 'wss://rabbitmq.example/ws',
      connectHeaders: { login: 'guest', passcode: 'guest' },
    }));
    expect(mockClient.activate).toHaveBeenCalledTimes(1);
  });

  it('publishes frame to exchange/routing key when connected', async () => {
    publisher = new QueuePublisher({ config: makeConfig(), clientFactory });
    await publisher.init();

    const callbacks = clientFactory.mock.calls[0][0];
    callbacks.onConnect();

    const packet = { event_id: 'evt-1', metrics: { dwell_time_ms: 2 } };
    const result = await publisher.publish(packet);

    expect(result).toEqual(expect.objectContaining({ published: true, buffered: false }));
    expect(mockClient.publish).toHaveBeenCalledWith(expect.objectContaining({
      destination: '/exchange/lumina.events/behavior.packet',
      body: JSON.stringify(packet),
    }));
  });

  it('emits disconnected status on socket close/error', async () => {
    const listener = vi.fn();
    publisher = new QueuePublisher({ config: makeConfig(), clientFactory });
    publisher.subscribeStatus(listener);

    await publisher.init();
    const callbacks = clientFactory.mock.calls[0][0];

    callbacks.onConnect();
    callbacks.onWebSocketClose({ code: 1006 });

    const status = publisher.getStatus();
    expect(status.connected).toBe(false);
    expect(status.lastError).toContain('disconnected');
    expect(listener).toHaveBeenCalled();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.QUEUE_STATUS_UPDATED,
    }));
  });

  it('reconnects with exponential backoff + jitter', async () => {
    const random = vi.fn(() => 0);
    publisher = new QueuePublisher({ config: makeConfig(), clientFactory, random });

    await publisher.init();
    const callbacks = clientFactory.mock.calls[0][0];

    callbacks.onWebSocketClose({ code: 1006 });

    expect(clientFactory).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(999);
    expect(clientFactory).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(clientFactory).toHaveBeenCalledTimes(2);

    clientFactory.mock.calls[1][0].onWebSocketClose({ code: 1006 });
    vi.advanceTimersByTime(2000);
    expect(clientFactory).toHaveBeenCalledTimes(3);
  });

  it('does not attempt publish while disconnected', async () => {
    publisher = new QueuePublisher({ config: makeConfig(), clientFactory });
    await publisher.init();

    const result = await publisher.publish({ event_id: 'evt-1' });

    expect(result).toEqual(expect.objectContaining({ published: false, buffered: true }));
    expect(mockClient.publish).not.toHaveBeenCalled();
  });

  it('failed publish pushes packet to ring buffer', async () => {
    mockClient.publish.mockImplementation(() => {
      throw new Error('publish failed');
    });

    publisher = new QueuePublisher({ config: makeConfig(), clientFactory });
    await publisher.init();
    clientFactory.mock.calls[0][0].onConnect();

    await publisher.publish({ event_id: 'evt-1' });

    const stored = await chrome.storage.local.get(BUFFER_PACKETS_KEY);
    expect(stored[BUFFER_PACKETS_KEY]).toHaveLength(1);
  });

  it('ring buffer caps at max size and drops oldest deterministically', async () => {
    publisher = new QueuePublisher({
      config: makeConfig(),
      clientFactory,
      maxBufferSize: 2,
    });
    await publisher.init();

    await publisher.publish({ event_id: 'a' });
    await publisher.publish({ event_id: 'b' });
    await publisher.publish({ event_id: 'c' });

    const stored = await chrome.storage.local.get(BUFFER_PACKETS_KEY);
    expect(stored[BUFFER_PACKETS_KEY].map((packet) => packet.event_id)).toEqual(['b', 'c']);
  });

  it('retry loop drains buffered packets in order after reconnect', async () => {
    publisher = new QueuePublisher({
      config: makeConfig(),
      clientFactory,
      flushIntervalMs: 5000,
    });
    await publisher.init();

    await publisher.publish({ event_id: 'a' });
    await publisher.publish({ event_id: 'b' });

    const callbacks = clientFactory.mock.calls[0][0];
    callbacks.onConnect();
    await publisher.flushBuffer();

    expect(mockClient.publish.mock.calls[0][0].body).toBe(JSON.stringify({ event_id: 'a' }));
    expect(mockClient.publish.mock.calls[1][0].body).toBe(JSON.stringify({ event_id: 'b' }));

    const stored = await chrome.storage.local.get(BUFFER_PACKETS_KEY);
    expect(stored[BUFFER_PACKETS_KEY]).toEqual([]);
  });

  it('partial flush preserves remaining items on mid-flush failure', async () => {
    publisher = new QueuePublisher({ config: makeConfig(), clientFactory });
    await publisher.init();

    await publisher.publish({ event_id: 'a' });
    await publisher.publish({ event_id: 'b' });

    mockClient.publish
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw new Error('second failed');
      });

    clientFactory.mock.calls[0][0].onConnect();
    await publisher.flushBuffer();

    const stored = await chrome.storage.local.get(BUFFER_PACKETS_KEY);
    expect(stored[BUFFER_PACKETS_KEY]).toEqual([{ event_id: 'b' }]);
  });

  it('retry state is reflected in QueueStatus', async () => {
    publisher = new QueuePublisher({ config: makeConfig(), clientFactory });
    await publisher.init();

    await publisher.publish({ event_id: 'a' });
    clientFactory.mock.calls[0][0].onConnect();

    const flushPromise = publisher.flushBuffer();
    expect(publisher.getStatus().retriesInFlight).toBe(true);
    await flushPromise;
    expect(publisher.getStatus().retriesInFlight).toBe(false);
  });
});

describe('createQueueConfig', () => {
  it('missing env vars yields disabled mode', () => {
    const config = createQueueConfig({ wsUrl: '', login: '', passcode: '' });
    expect(config.enabled).toBe(false);
  });

  it('present vars enables publisher config', () => {
    const config = createQueueConfig(makeConfig());
    expect(config.enabled).toBe(true);
  });
});
