var LuminaBackground = (function (exports) {
  'use strict';

  /**
   * Shared constants for Lumina Insight
   *
   * Learning states, platform types, and message types used across all layers.
   */

  /** Possible inferred learning states */
  const LearningState = Object.freeze({
    PENDING_LOCAL_AI: 'PENDING_LOCAL_AI',
    FOCUSED: 'FOCUSED',
    STALLED: 'STALLED',
    STRUGGLING: 'STRUGGLING',
    DEEP_READING: 'DEEP_READING',
    RE_READING: 'RE_READING',
  });

  /** Platform context types */
  const PlatformType = Object.freeze({
    QUIZ: 'QUIZ',
    POLL: 'POLL',
    LMS_READING: 'LMS_READING',
    PHYSICS_SIM: 'PHYSICS_SIM',
    UNKNOWN: 'UNKNOWN',
  });

  /** Message types for chrome.runtime.sendMessage routing */
  const MessageType = Object.freeze({
    BEHAVIORAL_PACKET: 'BEHAVIORAL_PACKET',
    INFERENCE_REQUEST: 'INFERENCE_REQUEST',
    INFERENCE_RESULT: 'INFERENCE_RESULT',
    GENERATE_NUDGE: 'GENERATE_NUDGE',
    GET_STATE: 'GET_STATE',
    STATE_UPDATED: 'STATE_UPDATED',
    QUEUE_STATUS_REQUEST: 'QUEUE_STATUS_REQUEST',
    QUEUE_STATUS_UPDATED: 'QUEUE_STATUS_UPDATED',
    QUEUE_FLUSH_REQUEST: 'QUEUE_FLUSH_REQUEST',
    HEARTBEAT: 'HEARTBEAT',
  });

  /** Sensor configuration defaults */
  const SensorConfig = Object.freeze({
    THROTTLE_INTERVAL_MS: 2000,
    DWELL_STALL_THRESHOLD_MS: 15000,
    RE_READ_CYCLE_THRESHOLD: 3,
    MOUSE_JITTER_NORMALIZATION_MAX: 500, // pixels
  });

  /**
   * Storage Manager — Session Persistence via chrome.storage.local
   *
   * Handles saving and loading the learning session state so the
   * Service Worker can restore state after being spun down.
   */

  /** Default session shape when nothing has been stored */
  const DEFAULT_SESSION = Object.freeze({
    lastState: null,
    lastNudge: null,
    lastPromptedState: null,
    lastPromptedContent: null,
    packetCount: 0,
  });

  const STORAGE_KEY = 'session';

  /**
   * Save session data to chrome.storage.local.
   *
   * @param {object} data - Session data to persist
   * @returns {Promise<void>}
   */
  async function saveSession(data) {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: data });
    } catch (err) {
      console.error('[Lumina SW] Failed to save session:', err);
    }
  }

  /**
   * Load session data from chrome.storage.local.
   * Returns DEFAULT_SESSION if nothing is stored.
   *
   * @returns {Promise<object>} Session data
   */
  async function loadSession() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      return result[STORAGE_KEY] || { ...DEFAULT_SESSION };
    } catch (err) {
      console.error('[Lumina SW] Failed to load session:', err);
      return { ...DEFAULT_SESSION };
    }
  }

  /**
   * Nudge Logic — Translates raw LearningState into user-friendly messages
   *
   * This pure function powers the Side Panel content.
   */

  /**
   * Maps an inferred learning state to a UI nudge object.
   *
   * @param {string} state - The LearningState enum value
   * @param {string} platformType - The PlatformType enum value
   * @returns {{ title: string, message: string, type: string }} Nudge data
   */
  function mapStateToNudge(state, platformType = null) {
    switch (state) {
      case LearningState.STRUGGLING:
        if (platformType === PlatformType.QUIZ) {
          return {
            type: 'struggling',
            title: 'Take a Breath',
            message: "80% of students find this question difficult. Don't stress!",
          };
        }
        return {
          type: 'struggling',
          title: 'Take a Breath',
          message: "It looks like you might be stuck. Let's break this problem down into smaller steps.",
        };

      case LearningState.STALLED:
        if (platformType === PlatformType.PHYSICS_SIM) {
          return {
            type: 'stalled',
            title: 'Need a Hint?',
            message: "You've been changing these variables a lot. Should we review the prerequisite formula?",
          };
        }
        return {
          type: 'stalled',
          title: 'Need a Hint?',
          message: "You've been on this for a while. Try reviewing the previous section for clues.",
        };

      case LearningState.FOCUSED:
        return {
          type: 'focused',
          title: 'On Fire!',
          message: "You're doing great! Keep up the momentum.",
        };

      case LearningState.DEEP_READING:
        return {
          type: 'deep-reading',
          title: 'Deep Focus',
          message: 'Great focus on the reading material. Take notes if you find anything complex!',
        };

      case LearningState.RE_READING:
        if (platformType === PlatformType.LMS_READING) {
          return {
            type: 're-reading',
            title: 'Reviewing',
            message: 'It looks like you are rereading this. Want me to generate a high-level synthesis of the key arguments?',
          };
        }
        return {
          type: 're-reading',
          title: 'Reviewing',
          message: 'Connecting the dots is great. Re-reading helps solidify complex concepts.',
        };

      case LearningState.PENDING_LOCAL_AI:
        return {
          type: 'pending',
          title: 'Analyzing...',
          message: 'Lumina is gathering insights on your learning patterns.',
        };

      default:
        // Includes null/undefined and unrecognized states
        return {
          type: 'idle',
          title: 'Idle',
          message: 'Browse to a supported learning platform to start receiving insights.',
        };
    }
  }

  /**
   * State Classifier — Rule-based learning state classification
   *
   * Maps behavioral metrics to learning state enums. This serves as both
   * a standalone classifier and a complement to the ONNX model.
   * The ONNX model can override these classifications when available.
   */

  // ─── Thresholds ────────────────────────────────────────────────────────────────

  const THRESHOLDS = {
    DWELL_HIGH: SensorConfig.DWELL_STALL_THRESHOLD_MS,       // 15000ms
    JITTER_HIGH: 0.5,
    JITTER_LOW: 0.1,
    TAB_SWITCH_HIGH: 3,
    RE_READ_CYCLES_HIGH: SensorConfig.RE_READ_CYCLE_THRESHOLD,
  };

  // ─── Classification ────────────────────────────────────────────────────────────

  /**
   * Classify the learning state from behavioral metrics using rule-based logic.
   *
   * Priority order:
   * 1. STRUGGLING — high dwell + high jitter (frustration signal)
   * 2. STALLED — high tab switches OR (high dwell + moderate jitter)
   * 3. DEEP_READING — high dwell + low jitter + no tab switches
   * 4. FOCUSED — default (student is engaged normally)
   *
   * @param {{ dwell_time_ms: number, scroll_velocity: number, mouse_jitter: number, tab_switches: number }} metrics
   * @returns {string} One of LearningState values
   */
  function classifyState(metrics, platformType = null) {
    const { dwell_time_ms, mouse_jitter, tab_switches, re_read_cycles } = metrics;

    // Domain Adapter: Physics Simulators (e.g. PhET)
    // Physics sims often involve tweaking variables repeatedly without submitting.
    // If time is high and jitter is low-medium but they haven't switched tabs,
    // we consider them STALLED rather than DEEP_READING.
    if (platformType === PlatformType.PHYSICS_SIM) {
      if (dwell_time_ms >= THRESHOLDS.DWELL_HIGH) {
        // High dwell time without completing the simulation
        if (mouse_jitter >= THRESHOLDS.JITTER_HIGH) return LearningState.STRUGGLING;
        return LearningState.STALLED; // They are stuck trying different variables without progress
      }
    }

    // Domain Adapter: Canvas LMS Reading
    // If reading a PDF or page and re-read cycles are high, it's specific.
    if (platformType === PlatformType.LMS_READING) {
      if (re_read_cycles && re_read_cycles >= THRESHOLDS.RE_READ_CYCLES_HIGH) {
        return LearningState.RE_READING;
      }
    }

    // High tab switches → distracted / stalled
    if (tab_switches >= THRESHOLDS.TAB_SWITCH_HIGH) {
      return LearningState.STALLED;
    }

    // Domain Adapter: Kahoot Quizzes
    // Anxious Learner: Kahoot has a timer. High jitter + moderate dwell = Struggling (hesitation)
    if (platformType === PlatformType.QUIZ) {
      if (dwell_time_ms >= (THRESHOLDS.DWELL_HIGH * 0.5) && mouse_jitter >= THRESHOLDS.JITTER_HIGH) {
        return LearningState.STRUGGLING; // Fast hesitation
      }
    }

    // Generic Rules

    // High re-read cycles → re-reading
    if (re_read_cycles && re_read_cycles >= THRESHOLDS.RE_READ_CYCLES_HIGH) {
      return LearningState.RE_READING;
    }

    // High dwell + high jitter → struggling (frustration)
    if (dwell_time_ms >= THRESHOLDS.DWELL_HIGH && mouse_jitter >= THRESHOLDS.JITTER_HIGH) {
      return LearningState.STRUGGLING;
    }

    // High dwell + moderate jitter → stalled
    if (dwell_time_ms >= THRESHOLDS.DWELL_HIGH && mouse_jitter >= THRESHOLDS.JITTER_LOW) {
      return LearningState.STALLED;
    }

    // High dwell + low jitter + 0 tab switches → deep reading
    if (dwell_time_ms >= THRESHOLDS.DWELL_HIGH && mouse_jitter < THRESHOLDS.JITTER_LOW && tab_switches === 0) {
      return LearningState.DEEP_READING;
    }

    // Default → focused
    return LearningState.FOCUSED;
  }

  /**
   * Packet — Behavioral Data Schema & Validation
   *
   * Defines the structured JSON "packet" that Content Scripts emit to the
   * Service Worker. Includes factory, validation, and sanitization functions.
   *
   * Privacy-first: sanitizePacket() strips any fields that could contain PII.
   */

  // ─── Allowed Fields (Allowlist for PII protection) ─────────────────────────────

  const ALLOWED_PACKET_FIELDS = ['event_id', 'session_hash', 'context', 'metrics', 'inferred_state', 'timestamp'];
  const ALLOWED_CONTEXT_FIELDS = ['domain', 'type'];
  const ALLOWED_METRICS_FIELDS = ['dwell_time_ms', 'scroll_velocity', 'mouse_jitter', 'tab_switches', 're_read_cycles'];

  // ─── Sanitization (Privacy) ────────────────────────────────────────────────────

  /**
   * Strips any fields not in the allowlist from a packet.
   * Returns a NEW object — does not mutate the input.
   *
   * @param {object} packet - Raw packet that may contain extra fields
   * @returns {object} A sanitized packet containing only allowed fields
   */
  function sanitizePacket(packet) {
    const sanitized = {};

    // Only copy allowed top-level fields
    for (const field of ALLOWED_PACKET_FIELDS) {
      if (field in packet) {
        sanitized[field] = packet[field];
      }
    }

    // Deep-sanitize context
    if (sanitized.context && typeof sanitized.context === 'object') {
      const cleanContext = {};
      for (const field of ALLOWED_CONTEXT_FIELDS) {
        if (field in sanitized.context) {
          cleanContext[field] = sanitized.context[field];
        }
      }
      sanitized.context = cleanContext;
    }

    // Deep-sanitize metrics
    if (sanitized.metrics && typeof sanitized.metrics === 'object') {
      const cleanMetrics = {};
      for (const field of ALLOWED_METRICS_FIELDS) {
        if (field in sanitized.metrics) {
          cleanMetrics[field] = sanitized.metrics[field];
        }
      }
      sanitized.metrics = cleanMetrics;
    }

    return sanitized;
  }

  /**
   * Offscreen Manager — Lifecycle management for the Offscreen Document
   *
   * The Offscreen Document hosts ONNX Runtime Web for on-device AI inference.
   * MV3 allows only one offscreen document at a time, so this manager
   * prevents duplicate creation and handles cleanup.
   */

  const OFFSCREEN_URL = 'src/offscreen/offscreen.html';
  const OFFSCREEN_REASONS = ['WORKERS'];
  const OFFSCREEN_JUSTIFICATION = 'Run ONNX Runtime Web inference for learning state detection';

  /**
   * Ensure the offscreen document exists. If it already exists, this is a no-op.
   *
   * @returns {Promise<void>}
   */
  async function ensureOffscreen() {
    try {
      const exists = await hasOffscreen();
      if (exists) return;

      await chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: OFFSCREEN_REASONS,
        justification: OFFSCREEN_JUSTIFICATION,
      });

      // Wait for the offscreen document's script to load and register listeners
      await new Promise((resolve) => setTimeout(resolve, 200));
      console.log('[Lumina SW] Offscreen document created and ready');
    } catch (err) {
      console.error('[Lumina SW] Failed to create offscreen document:', err);
    }
  }

  /**
   * Check if an offscreen document currently exists.
   *
   * @returns {Promise<boolean>}
   */
  async function hasOffscreen() {
    try {
      return chrome.offscreen.hasDocument();
    } catch (err) {
      console.error('[Lumina SW] Failed to check offscreen document:', err);
      return false;
    }
  }

  var stomp_umd$1 = {exports: {}};

  var stomp_umd = stomp_umd$1.exports;

  var hasRequiredStomp_umd;

  function requireStomp_umd () {
  	if (hasRequiredStomp_umd) return stomp_umd$1.exports;
  	hasRequiredStomp_umd = 1;
  	(function (module, exports$1) {
  		(function (global, factory) {
  		    factory(exports$1) ;
  		})(stomp_umd, (function (exports$1) {
  		    /**
  		     * @internal
  		     */
  		    function augmentWebsocket(webSocket, debug) {
  		        webSocket.terminate = function () {
  		            const noOp = () => { };
  		            // set all callbacks to no op
  		            this.onerror = noOp;
  		            this.onmessage = noOp;
  		            this.onopen = noOp;
  		            const ts = new Date();
  		            const id = Math.random().toString().substring(2, 8); // A simulated id
  		            const origOnClose = this.onclose;
  		            // Track delay in actual closure of the socket
  		            this.onclose = closeEvent => {
  		                const delay = new Date().getTime() - ts.getTime();
  		                debug(`Discarded socket (#${id})  closed after ${delay}ms, with code/reason: ${closeEvent.code}/${closeEvent.reason}`);
  		            };
  		            this.close();
  		            origOnClose?.call(webSocket, {
  		                code: 4001,
  		                reason: `Quick discarding socket (#${id}) without waiting for the shutdown sequence.`,
  		                wasClean: false,
  		            });
  		        };
  		    }

  		    /**
  		     * Some byte values, used as per STOMP specifications.
  		     *
  		     * Part of `@stomp/stompjs`.
  		     *
  		     * @internal
  		     */
  		    const BYTE = {
  		        // LINEFEED byte (octet 10)
  		        LF: '\x0A',
  		        // NULL byte (octet 0)
  		        NULL: '\x00',
  		    };

  		    /**
  		     * Frame class represents a STOMP frame.
  		     *
  		     * @internal
  		     */
  		    class FrameImpl {
  		        /**
  		         * body of the frame
  		         */
  		        get body() {
  		            if (!this._body && this.isBinaryBody) {
  		                this._body = new TextDecoder().decode(this._binaryBody);
  		            }
  		            return this._body || '';
  		        }
  		        /**
  		         * body as Uint8Array
  		         */
  		        get binaryBody() {
  		            if (!this._binaryBody && !this.isBinaryBody) {
  		                this._binaryBody = new TextEncoder().encode(this._body);
  		            }
  		            // At this stage it will definitely have a valid value
  		            return this._binaryBody;
  		        }
  		        /**
  		         * Frame constructor. `command`, `headers` and `body` are available as properties.
  		         *
  		         * @internal
  		         */
  		        constructor(params) {
  		            const { command, headers, body, binaryBody, escapeHeaderValues, skipContentLengthHeader, } = params;
  		            this.command = command;
  		            this.headers = Object.assign({}, headers || {});
  		            if (binaryBody) {
  		                this._binaryBody = binaryBody;
  		                this.isBinaryBody = true;
  		            }
  		            else {
  		                this._body = body || '';
  		                this.isBinaryBody = false;
  		            }
  		            this.escapeHeaderValues = escapeHeaderValues || false;
  		            this.skipContentLengthHeader = skipContentLengthHeader || false;
  		        }
  		        /**
  		         * deserialize a STOMP Frame from raw data.
  		         *
  		         * @internal
  		         */
  		        static fromRawFrame(rawFrame, escapeHeaderValues) {
  		            const headers = {};
  		            const trim = (str) => str.replace(/^\s+|\s+$/g, '');
  		            // In case of repeated headers, as per standards, first value need to be used
  		            for (const header of rawFrame.headers.reverse()) {
  		                header.indexOf(':');
  		                const key = trim(header[0]);
  		                let value = trim(header[1]);
  		                if (escapeHeaderValues &&
  		                    rawFrame.command !== 'CONNECT' &&
  		                    rawFrame.command !== 'CONNECTED') {
  		                    value = FrameImpl.hdrValueUnEscape(value);
  		                }
  		                headers[key] = value;
  		            }
  		            return new FrameImpl({
  		                command: rawFrame.command,
  		                headers,
  		                binaryBody: rawFrame.binaryBody,
  		                escapeHeaderValues,
  		            });
  		        }
  		        /**
  		         * @internal
  		         */
  		        toString() {
  		            return this.serializeCmdAndHeaders();
  		        }
  		        /**
  		         * serialize this Frame in a format suitable to be passed to WebSocket.
  		         * If the body is string the output will be string.
  		         * If the body is binary (i.e. of type Unit8Array) it will be serialized to ArrayBuffer.
  		         *
  		         * @internal
  		         */
  		        serialize() {
  		            const cmdAndHeaders = this.serializeCmdAndHeaders();
  		            if (this.isBinaryBody) {
  		                return FrameImpl.toUnit8Array(cmdAndHeaders, this._binaryBody).buffer;
  		            }
  		            else {
  		                return cmdAndHeaders + this._body + BYTE.NULL;
  		            }
  		        }
  		        serializeCmdAndHeaders() {
  		            const lines = [this.command];
  		            if (this.skipContentLengthHeader) {
  		                delete this.headers['content-length'];
  		            }
  		            for (const name of Object.keys(this.headers || {})) {
  		                const value = this.headers[name];
  		                if (this.escapeHeaderValues &&
  		                    this.command !== 'CONNECT' &&
  		                    this.command !== 'CONNECTED') {
  		                    lines.push(`${name}:${FrameImpl.hdrValueEscape(`${value}`)}`);
  		                }
  		                else {
  		                    lines.push(`${name}:${value}`);
  		                }
  		            }
  		            if (this.isBinaryBody ||
  		                (!this.isBodyEmpty() && !this.skipContentLengthHeader)) {
  		                lines.push(`content-length:${this.bodyLength()}`);
  		            }
  		            return lines.join(BYTE.LF) + BYTE.LF + BYTE.LF;
  		        }
  		        isBodyEmpty() {
  		            return this.bodyLength() === 0;
  		        }
  		        bodyLength() {
  		            const binaryBody = this.binaryBody;
  		            return binaryBody ? binaryBody.length : 0;
  		        }
  		        /**
  		         * Compute the size of a UTF-8 string by counting its number of bytes
  		         * (and not the number of characters composing the string)
  		         */
  		        static sizeOfUTF8(s) {
  		            return s ? new TextEncoder().encode(s).length : 0;
  		        }
  		        static toUnit8Array(cmdAndHeaders, binaryBody) {
  		            const uint8CmdAndHeaders = new TextEncoder().encode(cmdAndHeaders);
  		            const nullTerminator = new Uint8Array([0]);
  		            const uint8Frame = new Uint8Array(uint8CmdAndHeaders.length + binaryBody.length + nullTerminator.length);
  		            uint8Frame.set(uint8CmdAndHeaders);
  		            uint8Frame.set(binaryBody, uint8CmdAndHeaders.length);
  		            uint8Frame.set(nullTerminator, uint8CmdAndHeaders.length + binaryBody.length);
  		            return uint8Frame;
  		        }
  		        /**
  		         * Serialize a STOMP frame as per STOMP standards, suitable to be sent to the STOMP broker.
  		         *
  		         * @internal
  		         */
  		        static marshall(params) {
  		            const frame = new FrameImpl(params);
  		            return frame.serialize();
  		        }
  		        /**
  		         *  Escape header values
  		         */
  		        static hdrValueEscape(str) {
  		            return str
  		                .replace(/\\/g, '\\\\')
  		                .replace(/\r/g, '\\r')
  		                .replace(/\n/g, '\\n')
  		                .replace(/:/g, '\\c');
  		        }
  		        /**
  		         * UnEscape header values
  		         */
  		        static hdrValueUnEscape(str) {
  		            return str
  		                .replace(/\\r/g, '\r')
  		                .replace(/\\n/g, '\n')
  		                .replace(/\\c/g, ':')
  		                .replace(/\\\\/g, '\\');
  		        }
  		    }

  		    /**
  		     * @internal
  		     */
  		    const NULL = 0;
  		    /**
  		     * @internal
  		     */
  		    const LF = 10;
  		    /**
  		     * @internal
  		     */
  		    const CR = 13;
  		    /**
  		     * @internal
  		     */
  		    const COLON = 58;
  		    /**
  		     * This is an evented, rec descent parser.
  		     * A stream of Octets can be passed and whenever it recognizes
  		     * a complete Frame or an incoming ping it will invoke the registered callbacks.
  		     *
  		     * All incoming Octets are fed into _onByte function.
  		     * Depending on current state the _onByte function keeps changing.
  		     * Depending on the state it keeps accumulating into _token and _results.
  		     * State is indicated by current value of _onByte, all states are named as _collect.
  		     *
  		     * STOMP standards https://stomp.github.io/stomp-specification-1.2.html
  		     * imply that all lengths are considered in bytes (instead of string lengths).
  		     * So, before actual parsing, if the incoming data is String it is converted to Octets.
  		     * This allows faithful implementation of the protocol and allows NULL Octets to be present in the body.
  		     *
  		     * There is no peek function on the incoming data.
  		     * When a state change occurs based on an Octet without consuming the Octet,
  		     * the Octet, after state change, is fed again (_reinjectByte).
  		     * This became possible as the state change can be determined by inspecting just one Octet.
  		     *
  		     * There are two modes to collect the body, if content-length header is there then it by counting Octets
  		     * otherwise it is determined by NULL terminator.
  		     *
  		     * Following the standards, the command and headers are converted to Strings
  		     * and the body is returned as Octets.
  		     * Headers are returned as an array and not as Hash - to allow multiple occurrence of an header.
  		     *
  		     * This parser does not use Regular Expressions as that can only operate on Strings.
  		     *
  		     * It handles if multiple STOMP frames are given as one chunk, a frame is split into multiple chunks, or
  		     * any combination there of. The parser remembers its state (any partial frame) and continues when a new chunk
  		     * is pushed.
  		     *
  		     * Typically the higher level function will convert headers to Hash, handle unescaping of header values
  		     * (which is protocol version specific), and convert body to text.
  		     *
  		     * Check the parser.spec.js to understand cases that this parser is supposed to handle.
  		     *
  		     * Part of `@stomp/stompjs`.
  		     *
  		     * @internal
  		     */
  		    class Parser {
  		        constructor(onFrame, onIncomingPing) {
  		            this.onFrame = onFrame;
  		            this.onIncomingPing = onIncomingPing;
  		            this._encoder = new TextEncoder();
  		            this._decoder = new TextDecoder();
  		            this._token = [];
  		            this._initState();
  		        }
  		        parseChunk(segment, appendMissingNULLonIncoming = false) {
  		            let chunk;
  		            if (typeof segment === 'string') {
  		                chunk = this._encoder.encode(segment);
  		            }
  		            else {
  		                chunk = new Uint8Array(segment);
  		            }
  		            // See https://github.com/stomp-js/stompjs/issues/89
  		            // Remove when underlying issue is fixed.
  		            //
  		            // Send a NULL byte, if the last byte of a Text frame was not NULL.F
  		            if (appendMissingNULLonIncoming && chunk[chunk.length - 1] !== 0) {
  		                const chunkWithNull = new Uint8Array(chunk.length + 1);
  		                chunkWithNull.set(chunk, 0);
  		                chunkWithNull[chunk.length] = 0;
  		                chunk = chunkWithNull;
  		            }
  		            // tslint:disable-next-line:prefer-for-of
  		            for (let i = 0; i < chunk.length; i++) {
  		                const byte = chunk[i];
  		                this._onByte(byte);
  		            }
  		        }
  		        // The following implements a simple Rec Descent Parser.
  		        // The grammar is simple and just one byte tells what should be the next state
  		        _collectFrame(byte) {
  		            if (byte === NULL) {
  		                // Ignore
  		                return;
  		            }
  		            if (byte === CR) {
  		                // Ignore CR
  		                return;
  		            }
  		            if (byte === LF) {
  		                // Incoming Ping
  		                this.onIncomingPing();
  		                return;
  		            }
  		            this._onByte = this._collectCommand;
  		            this._reinjectByte(byte);
  		        }
  		        _collectCommand(byte) {
  		            if (byte === CR) {
  		                // Ignore CR
  		                return;
  		            }
  		            if (byte === LF) {
  		                this._results.command = this._consumeTokenAsUTF8();
  		                this._onByte = this._collectHeaders;
  		                return;
  		            }
  		            this._consumeByte(byte);
  		        }
  		        _collectHeaders(byte) {
  		            if (byte === CR) {
  		                // Ignore CR
  		                return;
  		            }
  		            if (byte === LF) {
  		                this._setupCollectBody();
  		                return;
  		            }
  		            this._onByte = this._collectHeaderKey;
  		            this._reinjectByte(byte);
  		        }
  		        _reinjectByte(byte) {
  		            this._onByte(byte);
  		        }
  		        _collectHeaderKey(byte) {
  		            if (byte === COLON) {
  		                this._headerKey = this._consumeTokenAsUTF8();
  		                this._onByte = this._collectHeaderValue;
  		                return;
  		            }
  		            this._consumeByte(byte);
  		        }
  		        _collectHeaderValue(byte) {
  		            if (byte === CR) {
  		                // Ignore CR
  		                return;
  		            }
  		            if (byte === LF) {
  		                this._results.headers.push([
  		                    this._headerKey,
  		                    this._consumeTokenAsUTF8(),
  		                ]);
  		                this._headerKey = undefined;
  		                this._onByte = this._collectHeaders;
  		                return;
  		            }
  		            this._consumeByte(byte);
  		        }
  		        _setupCollectBody() {
  		            const contentLengthHeader = this._results.headers.filter((header) => {
  		                return header[0] === 'content-length';
  		            })[0];
  		            if (contentLengthHeader) {
  		                this._bodyBytesRemaining = parseInt(contentLengthHeader[1], 10);
  		                this._onByte = this._collectBodyFixedSize;
  		            }
  		            else {
  		                this._onByte = this._collectBodyNullTerminated;
  		            }
  		        }
  		        _collectBodyNullTerminated(byte) {
  		            if (byte === NULL) {
  		                this._retrievedBody();
  		                return;
  		            }
  		            this._consumeByte(byte);
  		        }
  		        _collectBodyFixedSize(byte) {
  		            // It is post decrement, so that we discard the trailing NULL octet
  		            if (this._bodyBytesRemaining-- === 0) {
  		                this._retrievedBody();
  		                return;
  		            }
  		            this._consumeByte(byte);
  		        }
  		        _retrievedBody() {
  		            this._results.binaryBody = this._consumeTokenAsRaw();
  		            try {
  		                this.onFrame(this._results);
  		            }
  		            catch (e) {
  		                console.log(`Ignoring an exception thrown by a frame handler. Original exception: `, e);
  		            }
  		            this._initState();
  		        }
  		        // Rec Descent Parser helpers
  		        _consumeByte(byte) {
  		            this._token.push(byte);
  		        }
  		        _consumeTokenAsUTF8() {
  		            return this._decoder.decode(this._consumeTokenAsRaw());
  		        }
  		        _consumeTokenAsRaw() {
  		            const rawResult = new Uint8Array(this._token);
  		            this._token = [];
  		            return rawResult;
  		        }
  		        _initState() {
  		            this._results = {
  		                command: undefined,
  		                headers: [],
  		                binaryBody: undefined,
  		            };
  		            this._token = [];
  		            this._headerKey = undefined;
  		            this._onByte = this._collectFrame;
  		        }
  		    }

  		    /**
  		     * Possible states for the IStompSocket
  		     */
  		    exports$1.StompSocketState = void 0;
  		    (function (StompSocketState) {
  		        StompSocketState[StompSocketState["CONNECTING"] = 0] = "CONNECTING";
  		        StompSocketState[StompSocketState["OPEN"] = 1] = "OPEN";
  		        StompSocketState[StompSocketState["CLOSING"] = 2] = "CLOSING";
  		        StompSocketState[StompSocketState["CLOSED"] = 3] = "CLOSED";
  		    })(exports$1.StompSocketState || (exports$1.StompSocketState = {}));
  		    /**
  		     * Possible activation state
  		     */
  		    exports$1.ActivationState = void 0;
  		    (function (ActivationState) {
  		        ActivationState[ActivationState["ACTIVE"] = 0] = "ACTIVE";
  		        ActivationState[ActivationState["DEACTIVATING"] = 1] = "DEACTIVATING";
  		        ActivationState[ActivationState["INACTIVE"] = 2] = "INACTIVE";
  		    })(exports$1.ActivationState || (exports$1.ActivationState = {}));
  		    /**
  		     * Possible reconnection wait time modes
  		     */
  		    exports$1.ReconnectionTimeMode = void 0;
  		    (function (ReconnectionTimeMode) {
  		        ReconnectionTimeMode[ReconnectionTimeMode["LINEAR"] = 0] = "LINEAR";
  		        ReconnectionTimeMode[ReconnectionTimeMode["EXPONENTIAL"] = 1] = "EXPONENTIAL";
  		    })(exports$1.ReconnectionTimeMode || (exports$1.ReconnectionTimeMode = {}));
  		    /**
  		     * Possible ticker strategies for outgoing heartbeat ping
  		     */
  		    exports$1.TickerStrategy = void 0;
  		    (function (TickerStrategy) {
  		        TickerStrategy["Interval"] = "interval";
  		        TickerStrategy["Worker"] = "worker";
  		    })(exports$1.TickerStrategy || (exports$1.TickerStrategy = {}));

  		    class Ticker {
  		        constructor(_interval, _strategy = exports$1.TickerStrategy.Interval, _debug) {
  		            this._interval = _interval;
  		            this._strategy = _strategy;
  		            this._debug = _debug;
  		            this._workerScript = `
    var startTime = Date.now();
    setInterval(function() {
        self.postMessage(Date.now() - startTime);
    }, ${this._interval});
  `;
  		        }
  		        start(tick) {
  		            this.stop();
  		            if (this.shouldUseWorker()) {
  		                this.runWorker(tick);
  		            }
  		            else {
  		                this.runInterval(tick);
  		            }
  		        }
  		        stop() {
  		            this.disposeWorker();
  		            this.disposeInterval();
  		        }
  		        shouldUseWorker() {
  		            return (typeof Worker !== 'undefined' && this._strategy === exports$1.TickerStrategy.Worker);
  		        }
  		        runWorker(tick) {
  		            this._debug('Using runWorker for outgoing pings');
  		            if (!this._worker) {
  		                this._worker = new Worker(URL.createObjectURL(new Blob([this._workerScript], { type: 'text/javascript' })));
  		                this._worker.onmessage = message => tick(message.data);
  		            }
  		        }
  		        runInterval(tick) {
  		            this._debug('Using runInterval for outgoing pings');
  		            if (!this._timer) {
  		                const startTime = Date.now();
  		                this._timer = setInterval(() => {
  		                    tick(Date.now() - startTime);
  		                }, this._interval);
  		            }
  		        }
  		        disposeWorker() {
  		            if (this._worker) {
  		                this._worker.terminate();
  		                delete this._worker;
  		                this._debug('Outgoing ping disposeWorker');
  		            }
  		        }
  		        disposeInterval() {
  		            if (this._timer) {
  		                clearInterval(this._timer);
  		                delete this._timer;
  		                this._debug('Outgoing ping disposeInterval');
  		            }
  		        }
  		    }

  		    /**
  		     * Supported STOMP versions
  		     *
  		     * Part of `@stomp/stompjs`.
  		     */
  		    class Versions {
  		        /**
  		         * Takes an array of versions, typical elements '1.2', '1.1', or '1.0'
  		         *
  		         * You will be creating an instance of this class if you want to override
  		         * supported versions to be declared during STOMP handshake.
  		         */
  		        constructor(versions) {
  		            this.versions = versions;
  		        }
  		        /**
  		         * Used as part of CONNECT STOMP Frame
  		         */
  		        supportedVersions() {
  		            return this.versions.join(',');
  		        }
  		        /**
  		         * Used while creating a WebSocket
  		         */
  		        protocolVersions() {
  		            return this.versions.map(x => `v${x.replace('.', '')}.stomp`);
  		        }
  		    }
  		    /**
  		     * Indicates protocol version 1.0
  		     */
  		    Versions.V1_0 = '1.0';
  		    /**
  		     * Indicates protocol version 1.1
  		     */
  		    Versions.V1_1 = '1.1';
  		    /**
  		     * Indicates protocol version 1.2
  		     */
  		    Versions.V1_2 = '1.2';
  		    /**
  		     * @internal
  		     */
  		    Versions.default = new Versions([
  		        Versions.V1_2,
  		        Versions.V1_1,
  		        Versions.V1_0,
  		    ]);

  		    /**
  		     * The STOMP protocol handler
  		     *
  		     * Part of `@stomp/stompjs`.
  		     *
  		     * @internal
  		     */
  		    class StompHandler {
  		        get connectedVersion() {
  		            return this._connectedVersion;
  		        }
  		        get connected() {
  		            return this._connected;
  		        }
  		        constructor(_client, _webSocket, config) {
  		            this._client = _client;
  		            this._webSocket = _webSocket;
  		            this._connected = false;
  		            this._serverFrameHandlers = {
  		                // [CONNECTED Frame](https://stomp.github.com/stomp-specification-1.2.html#CONNECTED_Frame)
  		                CONNECTED: frame => {
  		                    this.debug(`connected to server ${frame.headers.server}`);
  		                    this._connected = true;
  		                    this._connectedVersion = frame.headers.version;
  		                    // STOMP version 1.2 needs header values to be escaped
  		                    if (this._connectedVersion === Versions.V1_2) {
  		                        this._escapeHeaderValues = true;
  		                    }
  		                    this._setupHeartbeat(frame.headers);
  		                    this.onConnect(frame);
  		                },
  		                // [MESSAGE Frame](https://stomp.github.com/stomp-specification-1.2.html#MESSAGE)
  		                MESSAGE: frame => {
  		                    // the callback is registered when the client calls
  		                    // `subscribe()`.
  		                    // If there is no registered subscription for the received message,
  		                    // the default `onUnhandledMessage` callback is used that the client can set.
  		                    // This is useful for subscriptions that are automatically created
  		                    // on the browser side (e.g. [RabbitMQ's temporary
  		                    // queues](https://www.rabbitmq.com/stomp.html)).
  		                    const subscription = frame.headers.subscription;
  		                    const onReceive = this._subscriptions[subscription] || this.onUnhandledMessage;
  		                    // bless the frame to be a Message
  		                    const message = frame;
  		                    const client = this;
  		                    const messageId = this._connectedVersion === Versions.V1_2
  		                        ? message.headers.ack
  		                        : message.headers['message-id'];
  		                    // add `ack()` and `nack()` methods directly to the returned frame
  		                    // so that a simple call to `message.ack()` can acknowledge the message.
  		                    message.ack = (headers = {}) => {
  		                        return client.ack(messageId, subscription, headers);
  		                    };
  		                    message.nack = (headers = {}) => {
  		                        return client.nack(messageId, subscription, headers);
  		                    };
  		                    onReceive(message);
  		                },
  		                // [RECEIPT Frame](https://stomp.github.com/stomp-specification-1.2.html#RECEIPT)
  		                RECEIPT: frame => {
  		                    const callback = this._receiptWatchers[frame.headers['receipt-id']];
  		                    if (callback) {
  		                        callback(frame);
  		                        // Server will acknowledge only once, remove the callback
  		                        delete this._receiptWatchers[frame.headers['receipt-id']];
  		                    }
  		                    else {
  		                        this.onUnhandledReceipt(frame);
  		                    }
  		                },
  		                // [ERROR Frame](https://stomp.github.com/stomp-specification-1.2.html#ERROR)
  		                ERROR: frame => {
  		                    this.onStompError(frame);
  		                },
  		            };
  		            // used to index subscribers
  		            this._counter = 0;
  		            // subscription callbacks indexed by subscriber's ID
  		            this._subscriptions = {};
  		            // receipt-watchers indexed by receipts-ids
  		            this._receiptWatchers = {};
  		            this._partialData = '';
  		            this._escapeHeaderValues = false;
  		            this._lastServerActivityTS = Date.now();
  		            this.debug = config.debug;
  		            this.stompVersions = config.stompVersions;
  		            this.connectHeaders = config.connectHeaders;
  		            this.disconnectHeaders = config.disconnectHeaders;
  		            this.heartbeatIncoming = config.heartbeatIncoming;
  		            this.heartbeatToleranceMultiplier = config.heartbeatGracePeriods;
  		            this.heartbeatOutgoing = config.heartbeatOutgoing;
  		            this.splitLargeFrames = config.splitLargeFrames;
  		            this.maxWebSocketChunkSize = config.maxWebSocketChunkSize;
  		            this.forceBinaryWSFrames = config.forceBinaryWSFrames;
  		            this.logRawCommunication = config.logRawCommunication;
  		            this.appendMissingNULLonIncoming = config.appendMissingNULLonIncoming;
  		            this.discardWebsocketOnCommFailure = config.discardWebsocketOnCommFailure;
  		            this.onConnect = config.onConnect;
  		            this.onDisconnect = config.onDisconnect;
  		            this.onStompError = config.onStompError;
  		            this.onWebSocketClose = config.onWebSocketClose;
  		            this.onWebSocketError = config.onWebSocketError;
  		            this.onUnhandledMessage = config.onUnhandledMessage;
  		            this.onUnhandledReceipt = config.onUnhandledReceipt;
  		            this.onUnhandledFrame = config.onUnhandledFrame;
  		            this.onHeartbeatReceived = config.onHeartbeatReceived;
  		            this.onHeartbeatLost = config.onHeartbeatLost;
  		        }
  		        start() {
  		            const parser = new Parser(
  		            // On Frame
  		            rawFrame => {
  		                const frame = FrameImpl.fromRawFrame(rawFrame, this._escapeHeaderValues);
  		                // if this.logRawCommunication is set, the rawChunk is logged at this._webSocket.onmessage
  		                if (!this.logRawCommunication) {
  		                    this.debug(`<<< ${frame}`);
  		                }
  		                const serverFrameHandler = this._serverFrameHandlers[frame.command] || this.onUnhandledFrame;
  		                serverFrameHandler(frame);
  		            }, 
  		            // On Incoming Ping
  		            () => {
  		                this.debug('<<< PONG');
  		                this.onHeartbeatReceived();
  		            });
  		            this._webSocket.onmessage = (evt) => {
  		                this.debug('Received data');
  		                this._lastServerActivityTS = Date.now();
  		                if (this.logRawCommunication) {
  		                    const rawChunkAsString = evt.data instanceof ArrayBuffer
  		                        ? new TextDecoder().decode(evt.data)
  		                        : evt.data;
  		                    this.debug(`<<< ${rawChunkAsString}`);
  		                }
  		                parser.parseChunk(evt.data, this.appendMissingNULLonIncoming);
  		            };
  		            this._webSocket.onclose = (closeEvent) => {
  		                this.debug(`Connection closed to ${this._webSocket.url}`);
  		                this._cleanUp();
  		                this.onWebSocketClose(closeEvent);
  		            };
  		            this._webSocket.onerror = (errorEvent) => {
  		                this.onWebSocketError(errorEvent);
  		            };
  		            const onOpen = () => {
  		                // Clone before updating
  		                const connectHeaders = Object.assign({}, this.connectHeaders);
  		                this.debug('Web Socket Opened...');
  		                connectHeaders['accept-version'] = this.stompVersions.supportedVersions();
  		                connectHeaders['heart-beat'] = [
  		                    this.heartbeatOutgoing,
  		                    this.heartbeatIncoming,
  		                ].join(',');
  		                this._transmit({ command: 'CONNECT', headers: connectHeaders });
  		            };
  		            if (this._webSocket.readyState === exports$1.StompSocketState.OPEN) {
  		                onOpen();
  		            }
  		            else {
  		                this._webSocket.onopen = onOpen;
  		            }
  		        }
  		        _setupHeartbeat(headers) {
  		            if (headers.version !== Versions.V1_1 &&
  		                headers.version !== Versions.V1_2) {
  		                return;
  		            }
  		            // It is valid for the server to not send this header
  		            // https://stomp.github.io/stomp-specification-1.2.html#Heart-beating
  		            if (!headers['heart-beat']) {
  		                return;
  		            }
  		            // heart-beat header received from the server looks like:
  		            //
  		            //     heart-beat: sx, sy
  		            const [serverOutgoing, serverIncoming] = headers['heart-beat']
  		                .split(',')
  		                .map((v) => parseInt(v, 10));
  		            if (this.heartbeatOutgoing !== 0 && serverIncoming !== 0) {
  		                const ttl = Math.max(this.heartbeatOutgoing, serverIncoming);
  		                this.debug(`send PING every ${ttl}ms`);
  		                this._pinger = new Ticker(ttl, this._client.heartbeatStrategy, this.debug);
  		                this._pinger.start(() => {
  		                    if (this._webSocket.readyState === exports$1.StompSocketState.OPEN) {
  		                        this._webSocket.send(BYTE.LF);
  		                        this.debug('>>> PING');
  		                    }
  		                });
  		            }
  		            if (this.heartbeatIncoming !== 0 && serverOutgoing !== 0) {
  		                const ttl = Math.max(this.heartbeatIncoming, serverOutgoing);
  		                this.debug(`check PONG every ${ttl}ms`);
  		                this._ponger = setInterval(() => {
  		                    const delta = Date.now() - this._lastServerActivityTS;
  		                    // We wait multiple grace periods to be flexible on window's setInterval calls
  		                    if (delta > ttl * this.heartbeatToleranceMultiplier) {
  		                        this.debug(`did not receive server activity for the last ${delta}ms`);
  		                        this.onHeartbeatLost();
  		                        this._closeOrDiscardWebsocket();
  		                    }
  		                }, ttl);
  		            }
  		        }
  		        _closeOrDiscardWebsocket() {
  		            if (this.discardWebsocketOnCommFailure) {
  		                this.debug('Discarding websocket, the underlying socket may linger for a while');
  		                this.discardWebsocket();
  		            }
  		            else {
  		                this.debug('Issuing close on the websocket');
  		                this._closeWebsocket();
  		            }
  		        }
  		        forceDisconnect() {
  		            if (this._webSocket) {
  		                if (this._webSocket.readyState === exports$1.StompSocketState.CONNECTING ||
  		                    this._webSocket.readyState === exports$1.StompSocketState.OPEN) {
  		                    this._closeOrDiscardWebsocket();
  		                }
  		            }
  		        }
  		        _closeWebsocket() {
  		            this._webSocket.onmessage = () => { }; // ignore messages
  		            this._webSocket.close();
  		        }
  		        discardWebsocket() {
  		            if (typeof this._webSocket.terminate !== 'function') {
  		                augmentWebsocket(this._webSocket, (msg) => this.debug(msg));
  		            }
  		            // @ts-ignore - this method will be there at this stage
  		            this._webSocket.terminate();
  		        }
  		        _transmit(params) {
  		            const { command, headers, body, binaryBody, skipContentLengthHeader } = params;
  		            const frame = new FrameImpl({
  		                command,
  		                headers,
  		                body,
  		                binaryBody,
  		                escapeHeaderValues: this._escapeHeaderValues,
  		                skipContentLengthHeader,
  		            });
  		            let rawChunk = frame.serialize();
  		            if (this.logRawCommunication) {
  		                this.debug(`>>> ${rawChunk}`);
  		            }
  		            else {
  		                this.debug(`>>> ${frame}`);
  		            }
  		            if (this.forceBinaryWSFrames && typeof rawChunk === 'string') {
  		                rawChunk = new TextEncoder().encode(rawChunk);
  		            }
  		            if (typeof rawChunk !== 'string' || !this.splitLargeFrames) {
  		                this._webSocket.send(rawChunk);
  		            }
  		            else {
  		                let out = rawChunk;
  		                while (out.length > 0) {
  		                    const chunk = out.substring(0, this.maxWebSocketChunkSize);
  		                    out = out.substring(this.maxWebSocketChunkSize);
  		                    this._webSocket.send(chunk);
  		                    this.debug(`chunk sent = ${chunk.length}, remaining = ${out.length}`);
  		                }
  		            }
  		        }
  		        dispose() {
  		            if (this.connected) {
  		                try {
  		                    // clone before updating
  		                    const disconnectHeaders = Object.assign({}, this.disconnectHeaders);
  		                    if (!disconnectHeaders.receipt) {
  		                        disconnectHeaders.receipt = `close-${this._counter++}`;
  		                    }
  		                    this.watchForReceipt(disconnectHeaders.receipt, frame => {
  		                        this._closeWebsocket();
  		                        this._cleanUp();
  		                        this.onDisconnect(frame);
  		                    });
  		                    this._transmit({ command: 'DISCONNECT', headers: disconnectHeaders });
  		                }
  		                catch (error) {
  		                    this.debug(`Ignoring error during disconnect ${error}`);
  		                }
  		            }
  		            else {
  		                if (this._webSocket.readyState === exports$1.StompSocketState.CONNECTING ||
  		                    this._webSocket.readyState === exports$1.StompSocketState.OPEN) {
  		                    this._closeWebsocket();
  		                }
  		            }
  		        }
  		        _cleanUp() {
  		            this._connected = false;
  		            if (this._pinger) {
  		                this._pinger.stop();
  		                this._pinger = undefined;
  		            }
  		            if (this._ponger) {
  		                clearInterval(this._ponger);
  		                this._ponger = undefined;
  		            }
  		        }
  		        publish(params) {
  		            const { destination, headers, body, binaryBody, skipContentLengthHeader } = params;
  		            const hdrs = Object.assign({ destination }, headers);
  		            this._transmit({
  		                command: 'SEND',
  		                headers: hdrs,
  		                body,
  		                binaryBody,
  		                skipContentLengthHeader,
  		            });
  		        }
  		        watchForReceipt(receiptId, callback) {
  		            this._receiptWatchers[receiptId] = callback;
  		        }
  		        subscribe(destination, callback, headers = {}) {
  		            headers = Object.assign({}, headers);
  		            if (!headers.id) {
  		                headers.id = `sub-${this._counter++}`;
  		            }
  		            headers.destination = destination;
  		            this._subscriptions[headers.id] = callback;
  		            this._transmit({ command: 'SUBSCRIBE', headers });
  		            const client = this;
  		            return {
  		                id: headers.id,
  		                unsubscribe(hdrs) {
  		                    return client.unsubscribe(headers.id, hdrs);
  		                },
  		            };
  		        }
  		        unsubscribe(id, headers = {}) {
  		            headers = Object.assign({}, headers);
  		            delete this._subscriptions[id];
  		            headers.id = id;
  		            this._transmit({ command: 'UNSUBSCRIBE', headers });
  		        }
  		        begin(transactionId) {
  		            const txId = transactionId || `tx-${this._counter++}`;
  		            this._transmit({
  		                command: 'BEGIN',
  		                headers: {
  		                    transaction: txId,
  		                },
  		            });
  		            const client = this;
  		            return {
  		                id: txId,
  		                commit() {
  		                    client.commit(txId);
  		                },
  		                abort() {
  		                    client.abort(txId);
  		                },
  		            };
  		        }
  		        commit(transactionId) {
  		            this._transmit({
  		                command: 'COMMIT',
  		                headers: {
  		                    transaction: transactionId,
  		                },
  		            });
  		        }
  		        abort(transactionId) {
  		            this._transmit({
  		                command: 'ABORT',
  		                headers: {
  		                    transaction: transactionId,
  		                },
  		            });
  		        }
  		        ack(messageId, subscriptionId, headers = {}) {
  		            headers = Object.assign({}, headers);
  		            if (this._connectedVersion === Versions.V1_2) {
  		                headers.id = messageId;
  		            }
  		            else {
  		                headers['message-id'] = messageId;
  		            }
  		            headers.subscription = subscriptionId;
  		            this._transmit({ command: 'ACK', headers });
  		        }
  		        nack(messageId, subscriptionId, headers = {}) {
  		            headers = Object.assign({}, headers);
  		            if (this._connectedVersion === Versions.V1_2) {
  		                headers.id = messageId;
  		            }
  		            else {
  		                headers['message-id'] = messageId;
  		            }
  		            headers.subscription = subscriptionId;
  		            return this._transmit({ command: 'NACK', headers });
  		        }
  		    }

  		    /**
  		     * STOMP Client Class.
  		     *
  		     * Part of `@stomp/stompjs`.
  		     *
  		     * This class provides a robust implementation for connecting to and interacting with a
  		     * STOMP-compliant messaging broker over WebSocket. It supports STOMP versions 1.2, 1.1, and 1.0.
  		     *
  		     * Features:
  		     * - Handles automatic reconnections.
  		     * - Supports heartbeat mechanisms to detect and report communication failures.
  		     * - Allows customization of connection and WebSocket behaviors through configurations.
  		     * - Compatible with both browser environments and Node.js with polyfill support for WebSocket.
  		     */
  		    class Client {
  		        /**
  		         * Provides access to the underlying WebSocket instance.
  		         * This property is **read-only**.
  		         *
  		         * Example:
  		         * ```javascript
  		         * const webSocket = client.webSocket;
  		         * if (webSocket) {
  		         *   console.log('WebSocket is connected:', webSocket.readyState === WebSocket.OPEN);
  		         * }
  		         * ```
  		         *
  		         * **Caution:**
  		         * Directly interacting with the WebSocket instance (e.g., sending or receiving frames)
  		         * can interfere with the proper functioning of this library. Such actions may cause
  		         * unexpected behavior, disconnections, or invalid state in the library's internal mechanisms.
  		         *
  		         * Instead, use the library's provided methods to manage STOMP communication.
  		         *
  		         * @returns The WebSocket instance used by the STOMP handler, or `undefined` if not connected.
  		         */
  		        get webSocket() {
  		            return this._stompHandler?._webSocket;
  		        }
  		        /**
  		         * Allows customization of the disconnection headers.
  		         *
  		         * Any changes made during an active session will also be applied immediately.
  		         *
  		         * Example:
  		         * ```javascript
  		         * client.disconnectHeaders = {
  		         *   receipt: 'custom-receipt-id'
  		         * };
  		         * ```
  		         */
  		        get disconnectHeaders() {
  		            return this._disconnectHeaders;
  		        }
  		        set disconnectHeaders(value) {
  		            this._disconnectHeaders = value;
  		            if (this._stompHandler) {
  		                this._stompHandler.disconnectHeaders = this._disconnectHeaders;
  		            }
  		        }
  		        /**
  		         * Indicates whether there is an active connection to the STOMP broker.
  		         *
  		         * Usage:
  		         * ```javascript
  		         * if (client.connected) {
  		         *   console.log('Client is connected to the broker.');
  		         * } else {
  		         *   console.log('No connection to the broker.');
  		         * }
  		         * ```
  		         *
  		         * @returns `true` if the client is currently connected, `false` otherwise.
  		         */
  		        get connected() {
  		            return !!this._stompHandler && this._stompHandler.connected;
  		        }
  		        /**
  		         * The version of the STOMP protocol negotiated with the server during connection.
  		         *
  		         * This is a **read-only** property and reflects the negotiated protocol version after
  		         * a successful connection.
  		         *
  		         * Example:
  		         * ```javascript
  		         * console.log('Connected STOMP version:', client.connectedVersion);
  		         * ```
  		         *
  		         * @returns The negotiated STOMP protocol version or `undefined` if not connected.
  		         */
  		        get connectedVersion() {
  		            return this._stompHandler ? this._stompHandler.connectedVersion : undefined;
  		        }
  		        /**
  		         * Indicates whether the client is currently active.
  		         *
  		         * A client is considered active if it is connected or actively attempting to reconnect.
  		         *
  		         * Example:
  		         * ```javascript
  		         * if (client.active) {
  		         *   console.log('The client is active.');
  		         * } else {
  		         *   console.log('The client is inactive.');
  		         * }
  		         * ```
  		         *
  		         * @returns `true` if the client is active, otherwise `false`.
  		         */
  		        get active() {
  		            return this.state === exports$1.ActivationState.ACTIVE;
  		        }
  		        _changeState(state) {
  		            this.state = state;
  		            this.onChangeState(state);
  		        }
  		        /**
  		         * Constructs a new STOMP client instance.
  		         *
  		         * The constructor initializes default values and sets up no-op callbacks for all events.
  		         * Configuration can be passed during construction, or updated later using `configure`.
  		         *
  		         * Example:
  		         * ```javascript
  		         * const client = new Client({
  		         *   brokerURL: 'wss://broker.example.com',
  		         *   reconnectDelay: 5000
  		         * });
  		         * ```
  		         *
  		         * @param conf Optional configuration object to initialize the client with.
  		         */
  		        constructor(conf = {}) {
  		            /**
  		             * STOMP protocol versions to use during the handshake. By default, the client will attempt
  		             * versions `1.2`, `1.1`, and `1.0` in descending order of preference.
  		             *
  		             * Example:
  		             * ```javascript
  		             * // Configure the client to only use versions 1.1 and 1.0
  		             * client.stompVersions = new Versions(['1.1', '1.0']);
  		             * ```
  		             */
  		            this.stompVersions = Versions.default;
  		            /**
  		             * Timeout for establishing STOMP connection, in milliseconds.
  		             *
  		             * If the connection is not established within this period, the attempt will fail.
  		             * The default is `0`, meaning no timeout is set for connection attempts.
  		             *
  		             * Example:
  		             * ```javascript
  		             * client.connectionTimeout = 5000; // Fail connection if not established in 5 seconds
  		             * ```
  		             */
  		            this.connectionTimeout = 0;
  		            /**
  		             * Delay (in milliseconds) between reconnection attempts if the connection drops.
  		             *
  		             * Set to `0` to disable automatic reconnections. The default value is `5000` ms (5 seconds).
  		             *
  		             * Example:
  		             * ```javascript
  		             * client.reconnectDelay = 3000; // Attempt reconnection every 3 seconds
  		             * client.reconnectDelay = 0; // Disable automatic reconnection
  		             * ```
  		             */
  		            this.reconnectDelay = 5000;
  		            /**
  		             * The next reconnection delay, used internally.
  		             * Initialized to the value of [Client#reconnectDelay]{@link Client#reconnectDelay}, and it may
  		             * dynamically change based on [Client#reconnectTimeMode]{@link Client#reconnectTimeMode}.
  		             */
  		            this._nextReconnectDelay = 0;
  		            /**
  		             * Maximum delay (in milliseconds) between reconnection attempts when using exponential backoff.
  		             *
  		             * Default is 15 minutes (`15 * 60 * 1000` milliseconds). If `0`, there will be no upper limit.
  		             *
  		             * Example:
  		             * ```javascript
  		             * client.maxReconnectDelay = 10000; // Maximum wait time is 10 seconds
  		             * ```
  		             */
  		            this.maxReconnectDelay = 15 * 60 * 1000;
  		            /**
  		             * Mode for determining the time interval between reconnection attempts.
  		             *
  		             * Available modes:
  		             * - `ReconnectionTimeMode.LINEAR` (default): Fixed delays between reconnection attempts.
  		             * - `ReconnectionTimeMode.EXPONENTIAL`: Delay doubles after each attempt, capped by [maxReconnectDelay]{@link Client#maxReconnectDelay}.
  		             *
  		             * Example:
  		             * ```javascript
  		             * client.reconnectTimeMode = ReconnectionTimeMode.EXPONENTIAL;
  		             * client.reconnectDelay = 200; // Initial delay of 200 ms, doubles with each attempt
  		             * client.maxReconnectDelay = 2 * 60 * 1000; // Cap delay at 10 minutes
  		             * ```
  		             */
  		            this.reconnectTimeMode = exports$1.ReconnectionTimeMode.LINEAR;
  		            /**
  		             * Interval (in milliseconds) for receiving heartbeat signals from the server.
  		             *
  		             * Specifies the expected frequency of heartbeats sent by the server. Set to `0` to disable.
  		             *
  		             * Example:
  		             * ```javascript
  		             * client.heartbeatIncoming = 10000; // Expect a heartbeat every 10 seconds
  		             * ```
  		             */
  		            this.heartbeatIncoming = 10000;
  		            /**
  		             * Multiplier for adjusting tolerance when processing heartbeat signals.
  		             *
  		             * Tolerance level is calculated using the multiplier:
  		             * `tolerance = heartbeatIncoming * heartbeatToleranceMultiplier`.
  		             * This helps account for delays in network communication or variations in timings.
  		             *
  		             * Default value is `2`.
  		             *
  		             * Example:
  		             * ```javascript
  		             * client.heartbeatToleranceMultiplier = 2.5; // Tolerates longer delays
  		             * ```
  		             */
  		            this.heartbeatToleranceMultiplier = 2;
  		            /**
  		             * Interval (in milliseconds) for sending heartbeat signals to the server.
  		             *
  		             * Specifies how frequently heartbeats should be sent to the server. Set to `0` to disable.
  		             *
  		             * Example:
  		             * ```javascript
  		             * client.heartbeatOutgoing = 5000; // Send a heartbeat every 5 seconds
  		             * ```
  		             */
  		            this.heartbeatOutgoing = 10000;
  		            /**
  		             * Strategy for sending outgoing heartbeats.
  		             *
  		             * Options:
  		             * - `TickerStrategy.Worker`: Uses Web Workers for sending heartbeats (recommended for long-running or background sessions).
  		             * - `TickerStrategy.Interval`: Uses standard JavaScript `setInterval` (default).
  		             *
  		             * Note:
  		             * - If Web Workers are unavailable (e.g., in Node.js), the `Interval` strategy is used automatically.
  		             * - Web Workers are preferable in browsers for reducing disconnects when tabs are in the background.
  		             *
  		             * Example:
  		             * ```javascript
  		             * client.heartbeatStrategy = TickerStrategy.Worker;
  		             * ```
  		             */
  		            this.heartbeatStrategy = exports$1.TickerStrategy.Interval;
  		            /**
  		             * Enables splitting of large text WebSocket frames into smaller chunks.
  		             *
  		             * This setting is enabled for brokers that support only chunked messages (e.g., Java Spring-based brokers).
  		             * Default is `false`.
  		             *
  		             * Warning:
  		             * - Should not be used with WebSocket-compliant brokers, as chunking may cause large message failures.
  		             * - Binary WebSocket frames are never split.
  		             *
  		             * Example:
  		             * ```javascript
  		             * client.splitLargeFrames = true;
  		             * client.maxWebSocketChunkSize = 4096; // Allow chunks of 4 KB
  		             * ```
  		             */
  		            this.splitLargeFrames = false;
  		            /**
  		             * Maximum size (in bytes) for individual WebSocket chunks if [splitLargeFrames]{@link Client#splitLargeFrames} is enabled.
  		             *
  		             * Default is 8 KB (`8 * 1024` bytes). This value has no effect if [splitLargeFrames]{@link Client#splitLargeFrames} is `false`.
  		             */
  		            this.maxWebSocketChunkSize = 8 * 1024;
  		            /**
  		             * Forces all WebSocket frames to use binary transport, irrespective of payload type.
  		             *
  		             * Default behavior determines frame type based on payload (e.g., binary data for ArrayBuffers).
  		             *
  		             * Example:
  		             * ```javascript
  		             * client.forceBinaryWSFrames = true;
  		             * ```
  		             */
  		            this.forceBinaryWSFrames = false;
  		            /**
  		             * Workaround for a React Native WebSocket bug, where messages containing `NULL` are chopped.
  		             *
  		             * Enabling this appends a `NULL` character to incoming frames to ensure they remain valid STOMP packets.
  		             *
  		             * Warning:
  		             * - For brokers that split large messages, this may cause data loss or connection termination.
  		             *
  		             * Example:
  		             * ```javascript
  		             * client.appendMissingNULLonIncoming = true;
  		             * ```
  		             */
  		            this.appendMissingNULLonIncoming = false;
  		            /**
  		             * Instruct the library to immediately terminate the socket on communication failures, even
  		             * before the WebSocket is completely closed.
  		             *
  		             * This is particularly useful in browser environments where WebSocket closure may get delayed,
  		             * causing prolonged reconnection intervals under certain failure conditions.
  		             *
  		             *
  		             * Example:
  		             * ```javascript
  		             * client.discardWebsocketOnCommFailure = true; // Enable aggressive closing of WebSocket
  		             * ```
  		             *
  		             * Default value: `false`.
  		             */
  		            this.discardWebsocketOnCommFailure = false;
  		            /**
  		             * Current activation state of the client.
  		             *
  		             * Possible states:
  		             * - `ActivationState.ACTIVE`: Client is connected or actively attempting to connect.
  		             * - `ActivationState.INACTIVE`: Client is disconnected and not attempting to reconnect.
  		             * - `ActivationState.DEACTIVATING`: Client is in the process of disconnecting.
  		             *
  		             * Note: The client may transition directly from `ACTIVE` to `INACTIVE` without entering
  		             * the `DEACTIVATING` state.
  		             */
  		            this.state = exports$1.ActivationState.INACTIVE;
  		            // No op callbacks
  		            const noOp = () => { };
  		            this.debug = noOp;
  		            this.beforeConnect = noOp;
  		            this.onConnect = noOp;
  		            this.onDisconnect = noOp;
  		            this.onUnhandledMessage = noOp;
  		            this.onUnhandledReceipt = noOp;
  		            this.onUnhandledFrame = noOp;
  		            this.onHeartbeatReceived = noOp;
  		            this.onHeartbeatLost = noOp;
  		            this.onStompError = noOp;
  		            this.onWebSocketClose = noOp;
  		            this.onWebSocketError = noOp;
  		            this.logRawCommunication = false;
  		            this.onChangeState = noOp;
  		            // These parameters would typically get proper values before connect is called
  		            this.connectHeaders = {};
  		            this._disconnectHeaders = {};
  		            // Apply configuration
  		            this.configure(conf);
  		        }
  		        /**
  		         * Updates the client's configuration.
  		         *
  		         * All properties in the provided configuration object will override the current settings.
  		         *
  		         * Additionally, a warning is logged if `maxReconnectDelay` is configured to a
  		         * value lower than `reconnectDelay`, and `maxReconnectDelay` is adjusted to match `reconnectDelay`.
  		         *
  		         * Example:
  		         * ```javascript
  		         * client.configure({
  		         *   reconnectDelay: 3000,
  		         *   maxReconnectDelay: 10000
  		         * });
  		         * ```
  		         *
  		         * @param conf Configuration object containing the new settings.
  		         */
  		        configure(conf) {
  		            // bulk assign all properties to this
  		            Object.assign(this, conf);
  		            // Warn on incorrect maxReconnectDelay settings
  		            if (this.maxReconnectDelay > 0 &&
  		                this.maxReconnectDelay < this.reconnectDelay) {
  		                this.debug(`Warning: maxReconnectDelay (${this.maxReconnectDelay}ms) is less than reconnectDelay (${this.reconnectDelay}ms). Using reconnectDelay as the maxReconnectDelay delay.`);
  		                this.maxReconnectDelay = this.reconnectDelay;
  		            }
  		        }
  		        /**
  		         * Activates the client, initiating a connection to the STOMP broker.
  		         *
  		         * On activation, the client attempts to connect and sets its state to `ACTIVE`. If the connection
  		         * is lost, it will automatically retry based on `reconnectDelay` or `maxReconnectDelay`. If
  		         * `reconnectTimeMode` is set to `EXPONENTIAL`, the reconnect delay increases exponentially.
  		         *
  		         * To stop reconnection attempts and disconnect, call [Client#deactivate]{@link Client#deactivate}.
  		         *
  		         * Example:
  		         * ```javascript
  		         * client.activate(); // Connect to the broker
  		         * ```
  		         *
  		         * If the client is currently `DEACTIVATING`, connection is delayed until the deactivation process completes.
  		         */
  		        activate() {
  		            const _activate = () => {
  		                if (this.active) {
  		                    this.debug('Already ACTIVE, ignoring request to activate');
  		                    return;
  		                }
  		                this._changeState(exports$1.ActivationState.ACTIVE);
  		                this._nextReconnectDelay = this.reconnectDelay;
  		                this._connect();
  		            };
  		            // if it is deactivating, wait for it to complete before activating.
  		            if (this.state === exports$1.ActivationState.DEACTIVATING) {
  		                this.debug('Waiting for deactivation to finish before activating');
  		                this.deactivate().then(() => {
  		                    _activate();
  		                });
  		            }
  		            else {
  		                _activate();
  		            }
  		        }
  		        async _connect() {
  		            await this.beforeConnect(this);
  		            if (this._stompHandler) {
  		                this.debug('There is already a stompHandler, skipping the call to connect');
  		                return;
  		            }
  		            if (!this.active) {
  		                this.debug('Client has been marked inactive, will not attempt to connect');
  		                return;
  		            }
  		            // setup connection watcher
  		            if (this.connectionTimeout > 0) {
  		                // clear first
  		                if (this._connectionWatcher) {
  		                    clearTimeout(this._connectionWatcher);
  		                }
  		                this._connectionWatcher = setTimeout(() => {
  		                    if (this.connected) {
  		                        return;
  		                    }
  		                    // Connection not established, close the underlying socket
  		                    // a reconnection will be attempted
  		                    this.debug(`Connection not established in ${this.connectionTimeout}ms, closing socket`);
  		                    this.forceDisconnect();
  		                }, this.connectionTimeout);
  		            }
  		            this.debug('Opening Web Socket...');
  		            // Get the actual WebSocket (or a similar object)
  		            const webSocket = this._createWebSocket();
  		            this._stompHandler = new StompHandler(this, webSocket, {
  		                debug: this.debug,
  		                stompVersions: this.stompVersions,
  		                connectHeaders: this.connectHeaders,
  		                disconnectHeaders: this._disconnectHeaders,
  		                heartbeatIncoming: this.heartbeatIncoming,
  		                heartbeatGracePeriods: this.heartbeatToleranceMultiplier,
  		                heartbeatOutgoing: this.heartbeatOutgoing,
  		                heartbeatStrategy: this.heartbeatStrategy,
  		                splitLargeFrames: this.splitLargeFrames,
  		                maxWebSocketChunkSize: this.maxWebSocketChunkSize,
  		                forceBinaryWSFrames: this.forceBinaryWSFrames,
  		                logRawCommunication: this.logRawCommunication,
  		                appendMissingNULLonIncoming: this.appendMissingNULLonIncoming,
  		                discardWebsocketOnCommFailure: this.discardWebsocketOnCommFailure,
  		                onConnect: frame => {
  		                    // Successfully connected, stop the connection watcher
  		                    if (this._connectionWatcher) {
  		                        clearTimeout(this._connectionWatcher);
  		                        this._connectionWatcher = undefined;
  		                    }
  		                    // Reset reconnect delay after successful connection
  		                    this._nextReconnectDelay = this.reconnectDelay;
  		                    if (!this.active) {
  		                        this.debug('STOMP got connected while deactivate was issued, will disconnect now');
  		                        this._disposeStompHandler();
  		                        return;
  		                    }
  		                    this.onConnect(frame);
  		                },
  		                onDisconnect: frame => {
  		                    this.onDisconnect(frame);
  		                },
  		                onStompError: frame => {
  		                    this.onStompError(frame);
  		                },
  		                onWebSocketClose: evt => {
  		                    this._stompHandler = undefined; // a new one will be created in case of a reconnect
  		                    if (this.state === exports$1.ActivationState.DEACTIVATING) {
  		                        // Mark deactivation complete
  		                        this._changeState(exports$1.ActivationState.INACTIVE);
  		                    }
  		                    // The callback is called before attempting to reconnect, this would allow the client
  		                    // to be `deactivated` in the callback.
  		                    this.onWebSocketClose(evt);
  		                    if (this.active) {
  		                        this._schedule_reconnect();
  		                    }
  		                },
  		                onWebSocketError: evt => {
  		                    this.onWebSocketError(evt);
  		                },
  		                onUnhandledMessage: message => {
  		                    this.onUnhandledMessage(message);
  		                },
  		                onUnhandledReceipt: frame => {
  		                    this.onUnhandledReceipt(frame);
  		                },
  		                onUnhandledFrame: frame => {
  		                    this.onUnhandledFrame(frame);
  		                },
  		                onHeartbeatReceived: () => {
  		                    this.onHeartbeatReceived();
  		                },
  		                onHeartbeatLost: () => {
  		                    this.onHeartbeatLost();
  		                },
  		            });
  		            this._stompHandler.start();
  		        }
  		        _createWebSocket() {
  		            let webSocket;
  		            if (this.webSocketFactory) {
  		                webSocket = this.webSocketFactory();
  		            }
  		            else if (this.brokerURL) {
  		                webSocket = new WebSocket(this.brokerURL, this.stompVersions.protocolVersions());
  		            }
  		            else {
  		                throw new Error('Either brokerURL or webSocketFactory must be provided');
  		            }
  		            webSocket.binaryType = 'arraybuffer';
  		            return webSocket;
  		        }
  		        _schedule_reconnect() {
  		            if (this._nextReconnectDelay > 0) {
  		                this.debug(`STOMP: scheduling reconnection in ${this._nextReconnectDelay}ms`);
  		                this._reconnector = setTimeout(() => {
  		                    if (this.reconnectTimeMode === exports$1.ReconnectionTimeMode.EXPONENTIAL) {
  		                        this._nextReconnectDelay = this._nextReconnectDelay * 2;
  		                        // Truncated exponential backoff with a set limit unless disabled
  		                        if (this.maxReconnectDelay !== 0) {
  		                            this._nextReconnectDelay = Math.min(this._nextReconnectDelay, this.maxReconnectDelay);
  		                        }
  		                    }
  		                    this._connect();
  		                }, this._nextReconnectDelay);
  		            }
  		        }
  		        /**
  		         * Disconnects the client and stops the automatic reconnection loop.
  		         *
  		         * If there is an active STOMP connection at the time of invocation, the appropriate callbacks
  		         * will be triggered during the shutdown sequence. Once deactivated, the client will enter the
  		         * `INACTIVE` state, and no further reconnection attempts will be made.
  		         *
  		         * **Behavior**:
  		         * - If there is no active WebSocket connection, this method resolves immediately.
  		         * - If there is an active connection, the method waits for the underlying WebSocket
  		         *   to properly close before resolving.
  		         * - Multiple calls to this method are safe. Each invocation resolves upon completion.
  		         * - To reactivate, call [Client#activate]{@link Client#activate}.
  		         *
  		         * **Experimental Option:**
  		         * - By specifying the `force: true` option, the WebSocket connection is discarded immediately,
  		         *   bypassing both the STOMP and WebSocket shutdown sequences.
  		         * - **Caution:** Using `force: true` may leave the WebSocket in an inconsistent state,
  		         *   and brokers may not immediately detect the termination.
  		         *
  		         * Example:
  		         * ```javascript
  		         * // Graceful disconnect
  		         * await client.deactivate();
  		         *
  		         * // Forced disconnect to speed up shutdown when the connection is stale
  		         * await client.deactivate({ force: true });
  		         * ```
  		         *
  		         * @param options Configuration options for deactivation. Use `force: true` for immediate shutdown.
  		         * @returns A Promise that resolves when the deactivation process completes.
  		         */
  		        async deactivate(options = {}) {
  		            const force = options.force || false;
  		            const needToDispose = this.active;
  		            let retPromise;
  		            if (this.state === exports$1.ActivationState.INACTIVE) {
  		                this.debug(`Already INACTIVE, nothing more to do`);
  		                return Promise.resolve();
  		            }
  		            this._changeState(exports$1.ActivationState.DEACTIVATING);
  		            // Clear reconnection timer just to be safe
  		            this._nextReconnectDelay = 0;
  		            // Clear if a reconnection was scheduled
  		            if (this._reconnector) {
  		                clearTimeout(this._reconnector);
  		                this._reconnector = undefined;
  		            }
  		            if (this._stompHandler &&
  		                // @ts-ignore - if there is a _stompHandler, there is the webSocket
  		                this.webSocket.readyState !== exports$1.StompSocketState.CLOSED) {
  		                const origOnWebSocketClose = this._stompHandler.onWebSocketClose;
  		                // we need to wait for the underlying websocket to close
  		                retPromise = new Promise((resolve, reject) => {
  		                    // @ts-ignore - there is a _stompHandler
  		                    this._stompHandler.onWebSocketClose = evt => {
  		                        origOnWebSocketClose(evt);
  		                        resolve();
  		                    };
  		                });
  		            }
  		            else {
  		                // indicate that auto reconnect loop should terminate
  		                this._changeState(exports$1.ActivationState.INACTIVE);
  		                return Promise.resolve();
  		            }
  		            if (force) {
  		                this._stompHandler?.discardWebsocket();
  		            }
  		            else if (needToDispose) {
  		                this._disposeStompHandler();
  		            }
  		            return retPromise;
  		        }
  		        /**
  		         * Forces a disconnect by directly closing the WebSocket.
  		         *
  		         * Unlike a normal disconnect, this does not send a DISCONNECT sequence to the broker but
  		         * instead closes the WebSocket connection directly. After forcing a disconnect, the client
  		         * will automatically attempt to reconnect based on its `reconnectDelay` configuration.
  		         *
  		         * **Note:** To prevent further reconnect attempts, call [Client#deactivate]{@link Client#deactivate}.
  		         *
  		         * Example:
  		         * ```javascript
  		         * client.forceDisconnect();
  		         * ```
  		         */
  		        forceDisconnect() {
  		            if (this._stompHandler) {
  		                this._stompHandler.forceDisconnect();
  		            }
  		        }
  		        _disposeStompHandler() {
  		            // Dispose STOMP Handler
  		            if (this._stompHandler) {
  		                this._stompHandler.dispose();
  		            }
  		        }
  		        /**
  		         * Sends a message to the specified destination on the STOMP broker.
  		         *
  		         * The `body` must be a `string`. For non-string payloads (e.g., JSON), encode it as a string before sending.
  		         * If sending binary data, use the `binaryBody` parameter as a [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array).
  		         *
  		         * **Content-Length Behavior**:
  		         * - For non-binary messages, the `content-length` header is added by default.
  		         * - The `content-length` header can be skipped for text frames by setting `skipContentLengthHeader: true` in the parameters.
  		         * - For binary messages, the `content-length` header is always included.
  		         *
  		         * **Notes**:
  		         * - Ensure that brokers support binary frames before using `binaryBody`.
  		         * - Sending messages with NULL octets and missing `content-length` headers can cause brokers to disconnect and throw errors.
  		         *
  		         * Example:
  		         * ```javascript
  		         * // Basic text message
  		         * client.publish({ destination: "/queue/test", body: "Hello, STOMP" });
  		         *
  		         * // Text message with additional headers
  		         * client.publish({ destination: "/queue/test", headers: { priority: 9 }, body: "Hello, STOMP" });
  		         *
  		         * // Skip content-length header
  		         * client.publish({ destination: "/queue/test", body: "Hello, STOMP", skipContentLengthHeader: true });
  		         *
  		         * // Binary message
  		         * const binaryData = new Uint8Array([1, 2, 3, 4]);
  		         * client.publish({
  		         *   destination: '/topic/special',
  		         *   binaryBody: binaryData,
  		         *   headers: { 'content-type': 'application/octet-stream' }
  		         * });
  		         * ```
  		         */
  		        publish(params) {
  		            this._checkConnection();
  		            // @ts-ignore - we already checked that there is a _stompHandler, and it is connected
  		            this._stompHandler.publish(params);
  		        }
  		        _checkConnection() {
  		            if (!this.connected) {
  		                throw new TypeError('There is no underlying STOMP connection');
  		            }
  		        }
  		        /**
  		         * Monitors for a receipt acknowledgment from the broker for specific operations.
  		         *
  		         * Add a `receipt` header to the operation (like subscribe or publish), and use this method with
  		         * the same receipt ID to detect when the broker has acknowledged the operation's completion.
  		         *
  		         * The callback is invoked with the corresponding {@link IFrame} when the receipt is received.
  		         *
  		         * Example:
  		         * ```javascript
  		         * const receiptId = "unique-receipt-id";
  		         *
  		         * client.watchForReceipt(receiptId, (frame) => {
  		         *   console.log("Operation acknowledged by the broker:", frame);
  		         * });
  		         *
  		         * // Attach the receipt header to an operation
  		         * client.publish({ destination: "/queue/test", headers: { receipt: receiptId }, body: "Hello" });
  		         * ```
  		         *
  		         * @param receiptId Unique identifier for the receipt.
  		         * @param callback Callback function invoked on receiving the RECEIPT frame.
  		         */
  		        watchForReceipt(receiptId, callback) {
  		            this._checkConnection();
  		            // @ts-ignore - we already checked that there is a _stompHandler, and it is connected
  		            this._stompHandler.watchForReceipt(receiptId, callback);
  		        }
  		        /**
  		         * Subscribes to a destination on the STOMP broker.
  		         *
  		         * The callback is triggered for each message received from the subscribed destination. The message
  		         * is passed as an {@link IMessage} instance.
  		         *
  		         * **Subscription ID**:
  		         * - If no `id` is provided in `headers`, the library generates a unique subscription ID automatically.
  		         * - Provide an explicit `id` in `headers` if you wish to manage the subscription ID manually.
  		         *
  		         * Example:
  		         * ```javascript
  		         * const callback = (message) => {
  		         *   console.log("Received message:", message.body);
  		         * };
  		         *
  		         * // Auto-generated subscription ID
  		         * const subscription = client.subscribe("/queue/test", callback);
  		         *
  		         * // Explicit subscription ID
  		         * const mySubId = "my-subscription-id";
  		         * const subscription = client.subscribe("/queue/test", callback, { id: mySubId });
  		         * ```
  		         *
  		         * @param destination Destination to subscribe to.
  		         * @param callback Function invoked for each received message.
  		         * @param headers Optional headers for subscription, such as `id`.
  		         * @returns A {@link StompSubscription} which can be used to manage the subscription.
  		         */
  		        subscribe(destination, callback, headers = {}) {
  		            this._checkConnection();
  		            // @ts-ignore - we already checked that there is a _stompHandler, and it is connected
  		            return this._stompHandler.subscribe(destination, callback, headers);
  		        }
  		        /**
  		         * Unsubscribes from a subscription on the STOMP broker.
  		         *
  		         * Prefer using the `unsubscribe` method directly on the {@link StompSubscription} returned from `subscribe` for cleaner management:
  		         * ```javascript
  		         * const subscription = client.subscribe("/queue/test", callback);
  		         * // Unsubscribe using the subscription object
  		         * subscription.unsubscribe();
  		         * ```
  		         *
  		         * This method can also be used directly with the subscription ID.
  		         *
  		         * Example:
  		         * ```javascript
  		         * client.unsubscribe("my-subscription-id");
  		         * ```
  		         *
  		         * @param id Subscription ID to unsubscribe.
  		         * @param headers Optional headers to pass for the UNSUBSCRIBE frame.
  		         */
  		        unsubscribe(id, headers = {}) {
  		            this._checkConnection();
  		            // @ts-ignore - we already checked that there is a _stompHandler, and it is connected
  		            this._stompHandler.unsubscribe(id, headers);
  		        }
  		        /**
  		         * Starts a new transaction. The returned {@link ITransaction} object provides
  		         * methods for [commit]{@link ITransaction#commit} and [abort]{@link ITransaction#abort}.
  		         *
  		         * If `transactionId` is not provided, the library generates a unique ID internally.
  		         *
  		         * Example:
  		         * ```javascript
  		         * const tx = client.begin(); // Auto-generated ID
  		         *
  		         * // Or explicitly specify a transaction ID
  		         * const tx = client.begin("my-transaction-id");
  		         * ```
  		         *
  		         * @param transactionId Optional transaction ID.
  		         * @returns An instance of {@link ITransaction}.
  		         */
  		        begin(transactionId) {
  		            this._checkConnection();
  		            // @ts-ignore - we already checked that there is a _stompHandler, and it is connected
  		            return this._stompHandler.begin(transactionId);
  		        }
  		        /**
  		         * Commits a transaction.
  		         *
  		         * It is strongly recommended to call [commit]{@link ITransaction#commit} on
  		         * the transaction object returned by [client#begin]{@link Client#begin}.
  		         *
  		         * Example:
  		         * ```javascript
  		         * const tx = client.begin();
  		         * // Perform operations under this transaction
  		         * tx.commit();
  		         * ```
  		         *
  		         * @param transactionId The ID of the transaction to commit.
  		         */
  		        commit(transactionId) {
  		            this._checkConnection();
  		            // @ts-ignore - we already checked that there is a _stompHandler, and it is connected
  		            this._stompHandler.commit(transactionId);
  		        }
  		        /**
  		         * Aborts a transaction.
  		         *
  		         * It is strongly recommended to call [abort]{@link ITransaction#abort} directly
  		         * on the transaction object returned by [client#begin]{@link Client#begin}.
  		         *
  		         * Example:
  		         * ```javascript
  		         * const tx = client.begin();
  		         * // Perform operations under this transaction
  		         * tx.abort(); // Abort the transaction
  		         * ```
  		         *
  		         * @param transactionId The ID of the transaction to abort.
  		         */
  		        abort(transactionId) {
  		            this._checkConnection();
  		            // @ts-ignore - we already checked that there is a _stompHandler, and it is connected
  		            this._stompHandler.abort(transactionId);
  		        }
  		        /**
  		         * Acknowledges receipt of a message. Typically, this should be done by calling
  		         * [ack]{@link IMessage#ack} directly on the {@link IMessage} instance passed
  		         * to the subscription callback.
  		         *
  		         * Example:
  		         * ```javascript
  		         * const callback = (message) => {
  		         *   // Process the message
  		         *   message.ack(); // Acknowledge the message
  		         * };
  		         *
  		         * client.subscribe("/queue/example", callback, { ack: "client" });
  		         * ```
  		         *
  		         * @param messageId The ID of the message to acknowledge.
  		         * @param subscriptionId The ID of the subscription.
  		         * @param headers Optional headers for the acknowledgment frame.
  		         */
  		        ack(messageId, subscriptionId, headers = {}) {
  		            this._checkConnection();
  		            // @ts-ignore - we already checked that there is a _stompHandler, and it is connected
  		            this._stompHandler.ack(messageId, subscriptionId, headers);
  		        }
  		        /**
  		         * Rejects a message (negative acknowledgment). Like acknowledgments, this should
  		         * typically be done by calling [nack]{@link IMessage#nack} directly on the {@link IMessage}
  		         * instance passed to the subscription callback.
  		         *
  		         * Example:
  		         * ```javascript
  		         * const callback = (message) => {
  		         *   // Process the message
  		         *   if (isError(message)) {
  		         *     message.nack(); // Reject the message
  		         *   }
  		         * };
  		         *
  		         * client.subscribe("/queue/example", callback, { ack: "client" });
  		         * ```
  		         *
  		         * @param messageId The ID of the message to negatively acknowledge.
  		         * @param subscriptionId The ID of the subscription.
  		         * @param headers Optional headers for the NACK frame.
  		         */
  		        nack(messageId, subscriptionId, headers = {}) {
  		            this._checkConnection();
  		            // @ts-ignore - we already checked that there is a _stompHandler, and it is connected
  		            this._stompHandler.nack(messageId, subscriptionId, headers);
  		        }
  		    }

  		    /**
  		     * Configuration options for STOMP Client, each key corresponds to
  		     * field by the same name in {@link Client}. This can be passed to
  		     * the constructor of {@link Client} or to [Client#configure]{@link Client#configure}.
  		     *
  		     * Part of `@stomp/stompjs`.
  		     */
  		    class StompConfig {
  		    }

  		    /**
  		     * STOMP headers. Many function calls will accept headers as parameters.
  		     * The headers sent by Broker will be available as [IFrame#headers]{@link IFrame#headers}.
  		     *
  		     * `key` and `value` must be valid strings.
  		     * In addition, `key` must not contain `CR`, `LF`, or `:`.
  		     *
  		     * Part of `@stomp/stompjs`.
  		     */
  		    class StompHeaders {
  		    }

  		    /**
  		     * Part of `@stomp/stompjs`.
  		     *
  		     * @internal
  		     */
  		    class HeartbeatInfo {
  		        constructor(client) {
  		            this.client = client;
  		        }
  		        get outgoing() {
  		            return this.client.heartbeatOutgoing;
  		        }
  		        set outgoing(value) {
  		            this.client.heartbeatOutgoing = value;
  		        }
  		        get incoming() {
  		            return this.client.heartbeatIncoming;
  		        }
  		        set incoming(value) {
  		            this.client.heartbeatIncoming = value;
  		        }
  		    }

  		    /**
  		     * Available for backward compatibility, please shift to using {@link Client}.
  		     *
  		     * **Deprecated**
  		     *
  		     * Part of `@stomp/stompjs`.
  		     *
  		     * To upgrade, please follow the [Upgrade Guide](https://stomp-js.github.io/guide/stompjs/upgrading-stompjs.html)
  		     */
  		    class CompatClient extends Client {
  		        /**
  		         * Available for backward compatibility, please shift to using {@link Client}
  		         * and [Client#webSocketFactory]{@link Client#webSocketFactory}.
  		         *
  		         * **Deprecated**
  		         *
  		         * @internal
  		         */
  		        constructor(webSocketFactory) {
  		            super();
  		            /**
  		             * It is no op now. No longer needed. Large packets work out of the box.
  		             */
  		            this.maxWebSocketFrameSize = 16 * 1024;
  		            this._heartbeatInfo = new HeartbeatInfo(this);
  		            this.reconnect_delay = 0;
  		            this.webSocketFactory = webSocketFactory;
  		            // Default from previous version
  		            this.debug = (...message) => {
  		                console.log(...message);
  		            };
  		        }
  		        _parseConnect(...args) {
  		            let closeEventCallback;
  		            let connectCallback;
  		            let errorCallback;
  		            let headers = {};
  		            if (args.length < 2) {
  		                throw new Error('Connect requires at least 2 arguments');
  		            }
  		            if (typeof args[1] === 'function') {
  		                [headers, connectCallback, errorCallback, closeEventCallback] = args;
  		            }
  		            else {
  		                switch (args.length) {
  		                    case 6:
  		                        [
  		                            headers.login,
  		                            headers.passcode,
  		                            connectCallback,
  		                            errorCallback,
  		                            closeEventCallback,
  		                            headers.host,
  		                        ] = args;
  		                        break;
  		                    default:
  		                        [
  		                            headers.login,
  		                            headers.passcode,
  		                            connectCallback,
  		                            errorCallback,
  		                            closeEventCallback,
  		                        ] = args;
  		                }
  		            }
  		            return [headers, connectCallback, errorCallback, closeEventCallback];
  		        }
  		        /**
  		         * Available for backward compatibility, please shift to using [Client#activate]{@link Client#activate}.
  		         *
  		         * **Deprecated**
  		         *
  		         * The `connect` method accepts different number of arguments and types. See the Overloads list. Use the
  		         * version with headers to pass your broker specific options.
  		         *
  		         * overloads:
  		         * - connect(headers, connectCallback)
  		         * - connect(headers, connectCallback, errorCallback)
  		         * - connect(login, passcode, connectCallback)
  		         * - connect(login, passcode, connectCallback, errorCallback)
  		         * - connect(login, passcode, connectCallback, errorCallback, closeEventCallback)
  		         * - connect(login, passcode, connectCallback, errorCallback, closeEventCallback, host)
  		         *
  		         * params:
  		         * - headers, see [Client#connectHeaders]{@link Client#connectHeaders}
  		         * - connectCallback, see [Client#onConnect]{@link Client#onConnect}
  		         * - errorCallback, see [Client#onStompError]{@link Client#onStompError}
  		         * - closeEventCallback, see [Client#onWebSocketClose]{@link Client#onWebSocketClose}
  		         * - login [String], see [Client#connectHeaders](../classes/Client.html#connectHeaders)
  		         * - passcode [String], [Client#connectHeaders](../classes/Client.html#connectHeaders)
  		         * - host [String], see [Client#connectHeaders](../classes/Client.html#connectHeaders)
  		         *
  		         * To upgrade, please follow the [Upgrade Guide](../additional-documentation/upgrading.html)
  		         */
  		        connect(...args) {
  		            const out = this._parseConnect(...args);
  		            if (out[0]) {
  		                this.connectHeaders = out[0];
  		            }
  		            if (out[1]) {
  		                this.onConnect = out[1];
  		            }
  		            if (out[2]) {
  		                this.onStompError = out[2];
  		            }
  		            if (out[3]) {
  		                this.onWebSocketClose = out[3];
  		            }
  		            super.activate();
  		        }
  		        /**
  		         * Available for backward compatibility, please shift to using [Client#deactivate]{@link Client#deactivate}.
  		         *
  		         * **Deprecated**
  		         *
  		         * See:
  		         * [Client#onDisconnect]{@link Client#onDisconnect}, and
  		         * [Client#disconnectHeaders]{@link Client#disconnectHeaders}
  		         *
  		         * To upgrade, please follow the [Upgrade Guide](../additional-documentation/upgrading.html)
  		         */
  		        disconnect(disconnectCallback, headers = {}) {
  		            if (disconnectCallback) {
  		                this.onDisconnect = disconnectCallback;
  		            }
  		            this.disconnectHeaders = headers;
  		            super.deactivate();
  		        }
  		        /**
  		         * Available for backward compatibility, use [Client#publish]{@link Client#publish}.
  		         *
  		         * Send a message to a named destination. Refer to your STOMP broker documentation for types
  		         * and naming of destinations. The headers will, typically, be available to the subscriber.
  		         * However, there may be special purpose headers corresponding to your STOMP broker.
  		         *
  		         *  **Deprecated**, use [Client#publish]{@link Client#publish}
  		         *
  		         * Note: Body must be String. You will need to covert the payload to string in case it is not string (e.g. JSON)
  		         *
  		         * ```javascript
  		         *        client.send("/queue/test", {priority: 9}, "Hello, STOMP");
  		         *
  		         *        // If you want to send a message with a body, you must also pass the headers argument.
  		         *        client.send("/queue/test", {}, "Hello, STOMP");
  		         * ```
  		         *
  		         * To upgrade, please follow the [Upgrade Guide](../additional-documentation/upgrading.html)
  		         */
  		        send(destination, headers = {}, body = '') {
  		            headers = Object.assign({}, headers);
  		            const skipContentLengthHeader = headers['content-length'] === false;
  		            if (skipContentLengthHeader) {
  		                delete headers['content-length'];
  		            }
  		            this.publish({
  		                destination,
  		                headers: headers,
  		                body,
  		                skipContentLengthHeader,
  		            });
  		        }
  		        /**
  		         * Available for backward compatibility, renamed to [Client#reconnectDelay]{@link Client#reconnectDelay}.
  		         *
  		         * **Deprecated**
  		         */
  		        set reconnect_delay(value) {
  		            this.reconnectDelay = value;
  		        }
  		        /**
  		         * Available for backward compatibility, renamed to [Client#webSocket]{@link Client#webSocket}.
  		         *
  		         * **Deprecated**
  		         */
  		        get ws() {
  		            return this.webSocket;
  		        }
  		        /**
  		         * Available for backward compatibility, renamed to [Client#connectedVersion]{@link Client#connectedVersion}.
  		         *
  		         * **Deprecated**
  		         */
  		        get version() {
  		            return this.connectedVersion;
  		        }
  		        /**
  		         * Available for backward compatibility, renamed to [Client#onUnhandledMessage]{@link Client#onUnhandledMessage}.
  		         *
  		         * **Deprecated**
  		         */
  		        get onreceive() {
  		            return this.onUnhandledMessage;
  		        }
  		        /**
  		         * Available for backward compatibility, renamed to [Client#onUnhandledMessage]{@link Client#onUnhandledMessage}.
  		         *
  		         * **Deprecated**
  		         */
  		        set onreceive(value) {
  		            this.onUnhandledMessage = value;
  		        }
  		        /**
  		         * Available for backward compatibility, renamed to [Client#onUnhandledReceipt]{@link Client#onUnhandledReceipt}.
  		         * Prefer using [Client#watchForReceipt]{@link Client#watchForReceipt}.
  		         *
  		         * **Deprecated**
  		         */
  		        get onreceipt() {
  		            return this.onUnhandledReceipt;
  		        }
  		        /**
  		         * Available for backward compatibility, renamed to [Client#onUnhandledReceipt]{@link Client#onUnhandledReceipt}.
  		         *
  		         * **Deprecated**
  		         */
  		        set onreceipt(value) {
  		            this.onUnhandledReceipt = value;
  		        }
  		        /**
  		         * Available for backward compatibility, renamed to [Client#heartbeatIncoming]{@link Client#heartbeatIncoming}
  		         * [Client#heartbeatOutgoing]{@link Client#heartbeatOutgoing}.
  		         *
  		         * **Deprecated**
  		         */
  		        get heartbeat() {
  		            return this._heartbeatInfo;
  		        }
  		        /**
  		         * Available for backward compatibility, renamed to [Client#heartbeatIncoming]{@link Client#heartbeatIncoming}
  		         * [Client#heartbeatOutgoing]{@link Client#heartbeatOutgoing}.
  		         *
  		         * **Deprecated**
  		         */
  		        set heartbeat(value) {
  		            this.heartbeatIncoming = value.incoming;
  		            this.heartbeatOutgoing = value.outgoing;
  		        }
  		    }

  		    /**
  		     * STOMP Class, acts like a factory to create {@link Client}.
  		     *
  		     * Part of `@stomp/stompjs`.
  		     *
  		     * **Deprecated**
  		     *
  		     * It will be removed in next major version. Please switch to {@link Client}.
  		     */
  		    class Stomp {
  		        /**
  		         * This method creates a WebSocket client that is connected to
  		         * the STOMP server located at the url.
  		         *
  		         * ```javascript
  		         *        var url = "ws://localhost:61614/stomp";
  		         *        var client = Stomp.client(url);
  		         * ```
  		         *
  		         * **Deprecated**
  		         *
  		         * It will be removed in next major version. Please switch to {@link Client}
  		         * using [Client#brokerURL]{@link Client#brokerURL}.
  		         */
  		        static client(url, protocols) {
  		            // This is a hack to allow another implementation than the standard
  		            // HTML5 WebSocket class.
  		            //
  		            // It is possible to use another class by calling
  		            //
  		            //     Stomp.WebSocketClass = MozWebSocket
  		            //
  		            // *prior* to call `Stomp.client()`.
  		            //
  		            // This hack is deprecated and `Stomp.over()` method should be used
  		            // instead.
  		            // See remarks on the function Stomp.over
  		            if (protocols == null) {
  		                protocols = Versions.default.protocolVersions();
  		            }
  		            const wsFn = () => {
  		                const klass = Stomp.WebSocketClass || WebSocket;
  		                return new klass(url, protocols);
  		            };
  		            return new CompatClient(wsFn);
  		        }
  		        /**
  		         * This method is an alternative to [Stomp#client]{@link Stomp#client} to let the user
  		         * specify the WebSocket to use (either a standard HTML5 WebSocket or
  		         * a similar object).
  		         *
  		         * In order to support reconnection, the function Client._connect should be callable more than once.
  		         * While reconnecting
  		         * a new instance of underlying transport (TCP Socket, WebSocket or SockJS) will be needed. So, this function
  		         * alternatively allows passing a function that should return a new instance of the underlying socket.
  		         *
  		         * ```javascript
  		         *        var client = Stomp.over(function(){
  		         *          return new WebSocket('ws://localhost:15674/ws')
  		         *        });
  		         * ```
  		         *
  		         * **Deprecated**
  		         *
  		         * It will be removed in next major version. Please switch to {@link Client}
  		         * using [Client#webSocketFactory]{@link Client#webSocketFactory}.
  		         */
  		        static over(ws) {
  		            let wsFn;
  		            if (typeof ws === 'function') {
  		                wsFn = ws;
  		            }
  		            else {
  		                console.warn('Stomp.over did not receive a factory, auto reconnect will not work. ' +
  		                    'Please see https://stomp-js.github.io/api-docs/latest/classes/Stomp.html#over');
  		                wsFn = () => ws;
  		            }
  		            return new CompatClient(wsFn);
  		        }
  		    }
  		    /**
  		     * In case you need to use a non standard class for WebSocket.
  		     *
  		     * For example when using within NodeJS environment:
  		     *
  		     * ```javascript
  		     *        StompJs = require('../../esm5/');
  		     *        Stomp = StompJs.Stomp;
  		     *        Stomp.WebSocketClass = require('websocket').w3cwebsocket;
  		     * ```
  		     *
  		     * **Deprecated**
  		     *
  		     *
  		     * It will be removed in next major version. Please switch to {@link Client}
  		     * using [Client#webSocketFactory]{@link Client#webSocketFactory}.
  		     */
  		    // tslint:disable-next-line:variable-name
  		    Stomp.WebSocketClass = null;

  		    exports$1.Client = Client;
  		    exports$1.CompatClient = CompatClient;
  		    exports$1.FrameImpl = FrameImpl;
  		    exports$1.Parser = Parser;
  		    exports$1.Stomp = Stomp;
  		    exports$1.StompConfig = StompConfig;
  		    exports$1.StompHeaders = StompHeaders;
  		    exports$1.Versions = Versions;

  		}));
  		
  	} (stomp_umd$1, stomp_umd$1.exports));
  	return stomp_umd$1.exports;
  }

  var stomp_umdExports = /*@__PURE__*/ requireStomp_umd();

  /**
   * Create a STOMP client for RabbitMQ Web-STOMP.
   *
   * @param {object} options
   * @returns {Client}
   */
  function createStompClient(options) {
    return new stomp_umdExports.Client({
      ...options,
      reconnectDelay: 0,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
    });
  }

  const BUFFER_PACKETS_KEY = 'queue_buffer_packets';
  const BUFFER_META_KEY = 'queue_buffer_meta';

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

  function createQueueConfig(overrides = {}) {
    const wsUrl = overrides.wsUrl ?? "ws://localhost:15674/ws" ?? '';
    const login = overrides.login ?? "guest" ?? '';
    const passcode = overrides.passcode ?? "guest" ?? '';
    const exchange = overrides.exchange ?? "lumina.events" ?? 'lumina.events';
    const routingKey = overrides.routingKey ?? "behavior.packet" ?? 'behavior.packet';

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

  class QueuePublisher {
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

  function getQueuePublisher() {
    if (!queuePublisherSingleton) {
      queuePublisherSingleton = new QueuePublisher();
    }
    return queuePublisherSingleton;
  }

  /**
   * Message Router — Central message hub for the Service Worker
   *
   * Routes messages from Content Scripts, Popup, and Offscreen Document
   * to the appropriate handlers.
   */

  let queuePublisher = null;

  function resolveQueuePublisher() {
    if (!queuePublisher) {
      queuePublisher = getQueuePublisher();
    }
    return queuePublisher;
  }

  /** Send a message to the offscreen doc with a timeout */
  function sendToOffscreenWithTimeout(msg, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Offscreen response timed out')), timeoutMs);
      Promise.resolve(chrome.runtime.sendMessage(msg))
        .then((response) => {
          clearTimeout(timer);
          resolve(response);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  function hashString(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
      hash |= 0;
    }
    return `s_${Math.abs(hash)}`;
  }

  function createEventId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `evt_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  }

  function toTelemetryPacket(packet) {
    const sanitized = sanitizePacket(packet || {});
    const domain = sanitized?.context?.domain || 'unknown';
    return {
      ...sanitized,
      schema_version: 1,
      event_id: createEventId(),
      session_hash: hashString(domain),
    };
  }

  /**
   * Handle an incoming runtime message.
   *
   * @param {object} message - The message object with { type, payload }
   * @param {object} sender - chrome.runtime.MessageSender
   * @param {Function} sendResponse - callback to send a response
   */
  async function handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case MessageType.BEHAVIORAL_PACKET: {
          // Store the latest packet, classify state, and increment count
          const session = await loadSession();
          session.packetCount = (session.packetCount || 0) + 1;
          // Strip transient_content and PII before hitting storage constraints (UAC 1)
          session.latestPacket = sanitizePacket(message.payload);
          const telemetryPacket = toTelemetryPacket(message.payload);

          try {
            await resolveQueuePublisher().publish(telemetryPacket);
          } catch (publishErr) {
            console.warn('[Lumina SW] Queue publish failed:', publishErr.message);
          }

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
                console.log(`[Lumina SW] 📤 Generating Nudge for state: ${session.lastState}`);
                console.log(`[Lumina SW] 📎 Transient content: "${(currentContent || 'None').substring(0, 60)}"`);

                // Ensure offscreen doc exists (creates if needed, waits for listener)
                await ensureOffscreen();

                try {
                  // Send to offscreen doc for LLM-powered nudge generation
                  const generateResponse = await sendToOffscreenWithTimeout({
                    type: MessageType.GENERATE_NUDGE,
                    payload: {
                      state: session.lastState,
                      platform: message.payload.context.type,
                      transient_content: currentContent
                    }
                  });

                  if (generateResponse && generateResponse.nudge) {
                    session.lastNudge = generateResponse.nudge;
                    console.log('[Lumina SW] ✅ LLM Nudge received:', session.lastNudge.message?.substring(0, 60));
                  } else if (generateResponse && generateResponse.error) {
                    console.warn('[Lumina SW] Offscreen error:', generateResponse.error);
                    // Fallback to static nudge
                    const staticNudge = mapStateToNudge(session.lastState);
                    session.lastNudge = (staticNudge && staticNudge.type !== 'idle' && staticNudge.type !== 'pending')
                      ? { ...staticNudge, is_dynamic: false }
                      : null;
                  } else {
                    session.lastNudge = null;
                  }
                } catch (nudgeErr) {
                  console.warn('[Lumina SW] Nudge generation failed, using static fallback:', nudgeErr.message);
                  const staticNudge = mapStateToNudge(session.lastState);
                  session.lastNudge = (staticNudge && staticNudge.type !== 'idle' && staticNudge.type !== 'pending')
                    ? { ...staticNudge, is_dynamic: false }
                    : null;
                }

                // Update cache to prevent redundant calls
                session.lastPromptedState = session.lastState;
                session.lastPromptedContent = currentContent;
              } else {
                console.debug(`[Lumina SW] ♻️ Reusing cached nudge for state: ${session.lastState} (No change in state or content)`);
              }
              
              // Broadcast the new state to any open side panels or popups
              Promise.resolve(chrome.runtime.sendMessage({
                type: MessageType.STATE_UPDATED,
                payload: { state: session.lastState, nudge: session.lastNudge }
              })).catch(() => {
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

        case MessageType.QUEUE_STATUS_REQUEST: {
          sendResponse(resolveQueuePublisher().getStatus());
          break;
        }

        case MessageType.QUEUE_FLUSH_REQUEST: {
          await resolveQueuePublisher().flushBuffer();
          sendResponse({ accepted: true });
          break;
        }

        case MessageType.GET_STATE: {
          const session = await loadSession();
          // Return only safe fields — exclude raw page text (lastPromptedContent)
          sendResponse({
            lastState: session.lastState,
            packetCount: session.packetCount,
            lastNudge: session.lastNudge,
          });
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
  function initRouter() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // handleMessage is async, so we need to return true to keep the
      // sendResponse channel open
      handleMessage(message, sender, sendResponse);
      return true;
    });
  }

  /**
   * Federated Learning — Anonymous Weight Update & Idle Sync
   *
   * Generates anonymous weight updates and syncs them to a remote
   * endpoint only when the system is idle (UAC 3).
   * Zero PII: no domains, timestamps, or user identifiers.
   */

  const MODEL_VERSION = '0.1.0';
  const DEFAULT_SYNC_ENDPOINT = 'http://localhost:5000/api/federated/push';
  const WEIGHT_VECTOR_LENGTH = 10;

  // ─── Weight Update Generation ──────────────────────────────────────────────────

  /**
   * Generate an anonymous weight update payload.
   * Contains ONLY model weights and a hashed session ID — no PII.
   *
   * @param {number[]} localWeights - Model weight deltas from local training
   * @returns {object} Anonymous weight update JSON
   */
  function generateWeightUpdate(localWeights) {
    return {
      model_version: MODEL_VERSION,
      weights: localWeights,
      session_hash: generateSessionHash(),
      sample_count: localWeights.length,
    };
  }

  // ─── Idle Detection ────────────────────────────────────────────────────────────

  /**
   * Check if the system is idle (safe to sync weights).
   *
   * @param {number} detectionInterval - Seconds of inactivity to consider idle (default: 60)
   * @returns {Promise<boolean>}
   */
  async function shouldSync(detectionInterval = 60) {
    try {
      const state = await chrome.idle.queryState(detectionInterval);
      return state === 'idle';
    } catch (err) {
      console.error('[Lumina SW] Failed to query idle state:', err);
      return false;
    }
  }

  // ─── Weight Sync ───────────────────────────────────────────────────────────────

  /**
   * Sync weight updates to the federated endpoint.
   *
   * @param {object} update - Weight update from generateWeightUpdate()
   * @param {string} endpoint - Remote API URL
   * @param {{ checkIdle?: boolean }} options - Options
   * @returns {Promise<{ synced: boolean, reason?: string, error?: string }>}
   */
  async function syncWeights(update, endpoint, options = {}) {
    // Guard: don't sync during active study sessions
    if (options.checkIdle) {
      const idle = await shouldSync();
      if (!idle) {
        return { synced: false, reason: 'not_idle' };
      }
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      if (!response.ok) {
        return { synced: false, error: `HTTP error ${response.status}` };
      }

      return { synced: true };
    } catch (err) {
      console.error('[Lumina SW] Failed to sync weights:', err);
      return { synced: false, error: err.message };
    }
  }

  /**
   * Build a simple local update vector from current session state.
   *
   * @param {object} session
   * @returns {number[]}
   */
  function buildLocalWeights(session = {}) {
    const base = new Array(WEIGHT_VECTOR_LENGTH).fill(0);
    const packetCount = Number(session.packetCount || 0);
    const packetSignal = Math.min(packetCount / 100, 1);

    // Deterministic weak signal based on local session only (no PII).
    return base.map((_, idx) => Number((packetSignal * (idx + 1) * 0.01).toFixed(4)));
  }

  async function performFederatedSync(getSession, options = {}) {
    const endpoint = options.endpoint || DEFAULT_SYNC_ENDPOINT;

    try {
      const session = await getSession();
      const localWeights = buildLocalWeights(session);
      const update = generateWeightUpdate(localWeights);
      const result = await syncWeights(update, endpoint, { checkIdle: true });
      if (result.synced) {
        console.debug('[Lumina SW] Federated sync successful');
      } else {
        console.debug('[Lumina SW] Federated sync skipped/failed:', result.reason || result.error);
      }
    } catch (err) {
      console.warn('[Lumina SW] Federated sync failed:', err?.message || err);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────────

  /**
   * Generate a pseudorandom session hash for anonymization.
   * Not cryptographically secure — just a unique-enough identifier
   * to group weight updates from the same learning session.
   */
  function generateSessionHash() {
    const array = new Uint8Array(16);
    // Use crypto.getRandomValues if available, else fallback
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Service Worker Main — Wires routing, storage, and offscreen management
   *
   * This is the main entry point for the MV3 Service Worker. It:
   * 1. Registers the message router
   * 2. Sets up onInstalled handler for fresh-install initialization
   * 3. Manages the offscreen document lifecycle for AI inference
   */
  const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';

  // ---- Inject Node.js require polyfill for onnxruntime-web fallback ----
  if (typeof globalThis.require === 'undefined') {
    globalThis.require = function () { return {}; };
  }

  // ─── Initialization ────────────────────────────────────────────────────────────

  /**
   * Initialize the Service Worker: register listeners and restore state.
   */
  function initServiceWorker() {
    // Register the message router
    initRouter();
    getQueuePublisher().init().catch((err) => {
      console.warn('[Lumina SW] Queue publisher init failed:', err.message);
    });

    if (!isTestEnv) {
      // Register alarms for periodic federated sync (UAC: battery and offline efficient)
      chrome.alarms.create('federated-sync', { periodInMinutes: 1 });

      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'federated-sync') {
          performFederatedSync(loadSession);
        }
      });
    }

    // Handle extension lifecycle events
    chrome.runtime.onInstalled.addListener(async (details) => {
      if (details.reason === 'install') {
        // First install — initialize default session
        await saveSession({ ...DEFAULT_SESSION });
        console.debug('[Lumina SW] Extension installed — session initialized');
      } else if (details.reason === 'update') {
        console.debug('[Lumina SW] Extension updated');
      }
    });

    console.debug('[Lumina SW] Service Worker initialized');
  }

  // ─── Auto-initialize (only in real Chrome, not during tests) ───────────────────
  if (!isTestEnv && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onInstalled) {
    initServiceWorker();
  }

  exports.initServiceWorker = initServiceWorker;

  return exports;

})({});
