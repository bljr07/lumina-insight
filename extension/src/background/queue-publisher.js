import { MessageType } from '@shared/constants.js';
import { createStompClient } from './stomp-client.js';

export const BUFFER_PACKETS_KEY = 'queue_buffer_packets';
export const BUFFER_META_KEY = 'queue_buffer_meta';

const DEFAULT_MAX_BUFFER = 2000;
const DEFAULT_FLUSH_INTERVAL_MS = 10000;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

const DEFAULT_STATUS = Object.freeze({
  connected: false,
  connecting: false,
  lastError: null,
  bufferedCount: 0,
  lastPublishAt: null,
  lastPublishResult: null,
  retriesInFlight: false,
});

export function createQueueConfig(overrides = {}) {
  const wsUrl = overrides.wsUrl ?? process.env.RABBITMQ_WS_URL ?? '';
  const login = overrides.login ?? process.env.RABBITMQ_WS_LOGIN ?? '';
  const passcode = overrides.passcode ?? process.env.RABBITMQ_WS_PASSCODE ?? '';
  const exchange = overrides.exchange ?? process.env.RABBITMQ_EXCHANGE ?? 'lumina.events';
  const routingKey = overrides.routingKey ?? process.env.RABBITMQ_ROUTING_KEY ?? 'behavior.packet';

  const enabled = Boolean(wsUrl && login && passcode);

  return {
    wsUrl,
    login,
    passcode,
    exchange,
    routingKey,
    enabled,
  };
}

export class QueuePublisher {
  constructor({
    config = createQueueConfig(),
    clientFactory = createStompClient,
    storage = chrome.storage.local,
    runtime = chrome.runtime,
    maxBufferSize = DEFAULT_MAX_BUFFER,
    flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS,
    random = Math.random,
    now = Date.now,
    setTimeoutFn = (...args) => globalThis.setTimeout(...args),
    clearTimeoutFn = (...args) => globalThis.clearTimeout(...args),
    setIntervalFn = (...args) => globalThis.setInterval(...args),
    clearIntervalFn = (...args) => globalThis.clearInterval(...args),
  } = {}) {
    this.config = {
      ...config,
      enabled: typeof config.enabled === 'boolean'
        ? config.enabled
        : Boolean(config.wsUrl && config.login && config.passcode),
    };
    this.clientFactory = clientFactory;
    this.storage = storage;
    this.runtime = runtime;
    this.maxBufferSize = maxBufferSize;
    this.flushIntervalMs = flushIntervalMs;
    this.random = random;
    this.now = now;
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.setIntervalFn = setIntervalFn;
    this.clearIntervalFn = clearIntervalFn;

    this.client = null;
    this.buffer = [];
    this.listeners = new Set();
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.flushTimer = null;
    this.flushInFlightPromise = null;

    this.status = { ...DEFAULT_STATUS };

    if (!this.config.enabled) {
      this.status.lastError = 'Queue publisher disabled: missing RabbitMQ Web-STOMP config';
    }
  }

  async init() {
    await this.#hydrateBuffer();
    this.#setStatus({ bufferedCount: this.buffer.length });

    if (!this.config.enabled) {
      console.warn('[Lumina Queue] Publisher disabled due to missing env configuration');
      return;
    }

    this.#startFlushLoop();
    this.#connect();
  }

  async publish(packet) {
    if (!this.config.enabled) {
      this.#setStatus({ lastPublishResult: 'failed' });
      return { published: false, buffered: false };
    }

    if (!this.status.connected || !this.client) {
      await this.#pushToBuffer(packet);
      this.#setStatus({ lastPublishResult: 'buffered' });
      return { published: false, buffered: true };
    }

    try {
      this.#publishNow(packet);
      this.#setStatus({
        lastPublishResult: 'success',
        lastPublishAt: this.now(),
      });
      return { published: true, buffered: false };
    } catch (err) {
      await this.#pushToBuffer(packet);
      this.#setStatus({
        lastError: err.message,
        lastPublishResult: 'buffered',
      });
      return { published: false, buffered: true };
    }
  }

  async flushBuffer() {
    if (!this.config.enabled || !this.status.connected) {
      return;
    }
    if (this.flushInFlightPromise) {
      return this.flushInFlightPromise;
    }

    this.flushInFlightPromise = (async () => {
      this.#setStatus({ retriesInFlight: true });

      try {
        while (this.buffer.length > 0 && this.status.connected) {
          const packet = this.buffer[0];
          try {
            this.#publishNow(packet);
          } catch (err) {
            this.#setStatus({
              lastError: err.message,
              lastPublishResult: 'failed',
            });
            break;
          }

          this.buffer.shift();
          await this.#persistBuffer();
          this.#setStatus({
            bufferedCount: this.buffer.length,
            lastPublishAt: this.now(),
            lastPublishResult: 'success',
          });
        }
      } finally {
        this.#setStatus({ retriesInFlight: false });
        this.flushInFlightPromise = null;
      }
    })();

    return this.flushInFlightPromise;
  }

  getStatus() {
    return { ...this.status };
  }

  subscribeStatus(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async destroy() {
    if (this.reconnectTimer) {
      this.clearTimeoutFn(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.flushTimer) {
      this.clearIntervalFn(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.client && typeof this.client.deactivate === 'function') {
      await Promise.resolve(this.client.deactivate());
    }
    this.client = null;
  }

  #startFlushLoop() {
    if (this.flushTimer) {
      this.clearIntervalFn(this.flushTimer);
    }

    this.flushTimer = this.setIntervalFn(() => {
      this.flushBuffer().catch((err) => {
        this.#setStatus({
          lastError: err.message,
          lastPublishResult: 'failed',
        });
      });
    }, this.flushIntervalMs);
  }

  #connect() {
    if (!this.config.enabled || this.status.connecting || this.status.connected) {
      return;
    }

    this.#setStatus({ connecting: true, lastError: null });

    const client = this.clientFactory({
      brokerURL: this.config.wsUrl,
      connectHeaders: {
        login: this.config.login,
        passcode: this.config.passcode,
      },
      onConnect: () => {
        this.reconnectAttempts = 0;
        this.#setStatus({ connected: true, connecting: false, lastError: null });
        this.flushBuffer().catch((err) => {
          this.#setStatus({
            lastError: err.message,
            lastPublishResult: 'failed',
          });
        });
      },
      onStompError: (frame) => {
        const msg = frame?.headers?.message || frame?.body || 'STOMP broker error';
        this.#handleDisconnected(msg);
      },
      onWebSocketClose: () => {
        this.#handleDisconnected('Socket disconnected');
      },
      onWebSocketError: () => {
        this.#handleDisconnected('Socket disconnected');
      },
      debug: () => {},
    });

    this.client = client;
    this.client.activate();
  }

  #handleDisconnected(reason) {
    this.#setStatus({
      connected: false,
      connecting: false,
      lastError: reason,
    });

    if (!this.config.enabled) {
      return;
    }

    this.#scheduleReconnect();
  }

  #scheduleReconnect() {
    if (this.reconnectTimer) {
      this.clearTimeoutFn(this.reconnectTimer);
    }

    const attemptDelay = Math.min(
      BASE_RECONNECT_DELAY_MS * (2 ** this.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS,
    );
    const jitter = Math.floor(attemptDelay * 0.2 * this.random());
    const delayMs = attemptDelay + jitter;

    this.reconnectAttempts += 1;

    this.reconnectTimer = this.setTimeoutFn(() => {
      this.reconnectTimer = null;
      this.#connect();
    }, delayMs);
  }

  #publishNow(packet) {
    this.client.publish({
      destination: `/exchange/${this.config.exchange}/${this.config.routingKey}`,
      body: JSON.stringify(packet),
      headers: {
        'content-type': 'application/json',
      },
    });
  }

  async #pushToBuffer(packet) {
    this.buffer.push(packet);

    if (this.buffer.length > this.maxBufferSize) {
      this.buffer = this.buffer.slice(this.buffer.length - this.maxBufferSize);
    }

    await this.#persistBuffer();
    this.#setStatus({ bufferedCount: this.buffer.length });
  }

  async #hydrateBuffer() {
    const stored = await this.storage.get([BUFFER_PACKETS_KEY, BUFFER_META_KEY]);
    const packets = stored[BUFFER_PACKETS_KEY];
    this.buffer = Array.isArray(packets) ? packets : [];
  }

  async #persistBuffer() {
    await this.storage.set({
      [BUFFER_PACKETS_KEY]: this.buffer,
      [BUFFER_META_KEY]: { updatedAt: this.now() },
    });
  }

  #setStatus(update) {
    const next = {
      ...this.status,
      ...update,
    };

    const changed = JSON.stringify(next) !== JSON.stringify(this.status);
    this.status = next;

    if (!changed) {
      return;
    }

    for (const listener of this.listeners) {
      listener(this.getStatus());
    }

    Promise.resolve(this.runtime.sendMessage({
      type: MessageType.QUEUE_STATUS_UPDATED,
      payload: this.getStatus(),
    })).catch(() => {});
  }
}

let queuePublisherSingleton = null;

export function getQueuePublisher() {
  if (!queuePublisherSingleton) {
    queuePublisherSingleton = new QueuePublisher();
  }
  return queuePublisherSingleton;
}

export function setQueuePublisherForTesting(publisher) {
  queuePublisherSingleton = publisher;
}
