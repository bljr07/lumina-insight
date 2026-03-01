import { Client } from '@stomp/stompjs';

/**
 * Create a STOMP client for RabbitMQ Web-STOMP.
 *
 * @param {object} options
 * @returns {Client}
 */
export function createStompClient(options) {
  return new Client({
    ...options,
    reconnectDelay: 0,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
  });
}
